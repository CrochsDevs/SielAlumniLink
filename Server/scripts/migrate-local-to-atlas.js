import { MongoClient, BSON } from 'mongodb';
import dotenv from 'dotenv';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = dotenv.parse(await readFile(path.join(serverRoot, '.env')));
const atlasUri = process.env.MONGO_URI || env.MONGO_URI;
if (!atlasUri || !new URL(atlasUri).hostname.endsWith('.mongodb.net')) throw new Error('MONGO_URI must point to the destination Atlas cluster.');
const toolsDir = process.env.MONGO_TOOLS_DIR;
const apply = process.argv.includes('--apply');
const source = new MongoClient('mongodb://127.0.0.1:27017', { serverSelectionTimeoutMS: 10000 });
const target = new MongoClient(atlasUri, { serverSelectionTimeoutMS: 15000, maxPoolSize: 3 });
const excluded = new Set(['admin', 'config', 'local']);
let credentialsDir;

async function fingerprint(db, name) {
  const hash = createHash('sha256');
  let count = 0;
  for await (const doc of db.collection(name).find({}, { raw: true }).sort({ _id: 1 })) {
    hash.update(Buffer.isBuffer(doc) ? doc : BSON.serialize(doc));
    count++;
  }
  return { count, sha256: hash.digest('hex') };
}

function scrub(message) {
  let safe = message.replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, '[MongoDB URI redacted]');
  const uri = new URL(atlasUri);
  for (const value of [uri.password, decodeURIComponent(uri.password)]) {
    if (value) safe = safe.split(value).join('[redacted]');
  }
  return safe;
}

async function tool(name, args) {
  await new Promise((resolve, reject) => {
    const child = spawn(path.join(toolsDir, `${name}.exe`), args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('close', code => code === 0 ? resolve() : reject(new Error(`${name} failed (${code}): ${scrub(output)}`)));
  });
}

try {
  await source.connect();
  await target.connect();
  const databases = (await source.db('admin').admin().listDatabases({ nameOnly: true })).databases.map(item => item.name).filter(name => !excluded.has(name));
  const inventory = [];
  for (const name of databases) {
    const from = source.db(name), to = target.db(name);
    for (const collection of await to.listCollections().toArray()) {
      if (collection.type === 'collection' && await to.collection(collection.name).countDocuments() > 0) {
        throw new Error(`Atlas database ${name} already contains records. Stopped before changing destination data.`);
      }
    }
    for (const collection of await from.listCollections().toArray()) {
      if (collection.type !== 'collection') throw new Error(`Review required for ${name}.${collection.name} (${collection.type}).`);
      inventory.push({ database: name, collection: collection.name, ...await fingerprint(from, collection.name), indexes: await from.collection(collection.name).listIndexes().toArray() });
    }
  }
  console.log(JSON.stringify({ apply, databases, collections: inventory.length, documents: inventory.reduce((sum, item) => sum + item.count, 0) }));
  if (apply) {
    if (!toolsDir) throw new Error('Set MONGO_TOOLS_DIR to the official MongoDB Database Tools bin directory.');
    const backup = path.resolve(serverRoot, '../backups/mongodb', new Date().toISOString().replace(/[:.]/g, '-'));
    await mkdir(backup, { recursive: true });
    credentialsDir = await mkdtemp(path.join(os.tmpdir(), 'SielAlumni-mongo-migration-'));
    const config = path.join(credentialsDir, 'atlas.yml');
    const toolsUri = new URL(atlasUri);
    toolsUri.pathname = '/';
    await writeFile(config, `uri: ${JSON.stringify(toolsUri.toString())}\n`, { mode: 0o600 });
    await writeFile(path.join(backup, 'source-manifest.json'), BSON.EJSON.stringify(inventory, { relaxed: false }, 2));
    for (const name of databases) {
      await tool('mongodump', ['--uri', 'mongodb://127.0.0.1:27017', '--db', name, '--out', path.join(backup, 'local')]);
      await tool('mongodump', ['--config', config, '--db', name, '--out', path.join(backup, 'atlas-before')]);
    }
    console.log(`BSON backups completed: ${backup}`);
    // Check again immediately before restoring; existing data is never dropped.
    for (const item of inventory) {
      if (await target.db(item.database).collection(item.collection).countDocuments() > 0) throw new Error('Destination changed during backup. Restore cancelled.');
      const current = await fingerprint(source.db(item.database), item.collection);
      if (current.sha256 !== item.sha256) throw new Error('Local data changed during backup. Stop local writes and rerun.');
    }
    await tool('mongorestore', ['--config', config, '--dir', path.join(backup, 'local'), '--stopOnError', '--numParallelCollections', '2', '--writeConcern', 'majority', ...databases.flatMap(name => ['--nsInclude', `${name}.*`])]);
    console.log('Restore completed. Verifying document hashes and indexes...');
    const verified = [];
    for (const item of inventory) {
      const actual = await fingerprint(target.db(item.database), item.collection);
      if (actual.count !== item.count || actual.sha256 !== item.sha256) throw new Error(`Document verification failed for ${item.database}.${item.collection}. Backups retained at ${backup}.`);
      const actualIndexes = await target.db(item.database).collection(item.collection).listIndexes().toArray();
      for (const index of item.indexes) {
        const expected = Object.fromEntries(Object.entries(index).filter(([key]) => !['v', 'ns', 'background'].includes(key)));
        const found = actualIndexes.find(candidate => candidate.name === index.name);
        if (!found || Object.entries(expected).some(([key, value]) => BSON.EJSON.stringify(found[key], { relaxed: false }) !== BSON.EJSON.stringify(value, { relaxed: false }))) throw new Error(`Index verification failed for ${item.database}.${item.collection}.${index.name}.`);
      }
      verified.push({ database: item.database, collection: item.collection, ...actual, indexes: actualIndexes.length });
    }
    await writeFile(path.join(backup, 'verification.json'), JSON.stringify({ verifiedAt: new Date().toISOString(), verified }, null, 2));
    console.log(JSON.stringify({ success: true, databases, collections: verified.length, documents: verified.reduce((sum, item) => sum + item.count, 0), backup }));
  }
} catch (error) {
  console.error(scrub(error.message));
  process.exitCode = 1;
} finally {
  await Promise.allSettled([source.close(), target.close()]);
  if (credentialsDir) {
    const resolved = path.resolve(credentialsDir);
    if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith('SielAlumni-mongo-migration-')) throw new Error('Unexpected credentials cleanup path.');
    await rm(resolved, { recursive: true, force: true });
  }
}
