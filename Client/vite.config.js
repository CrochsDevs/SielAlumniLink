import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const chatHookModules = new Set([
  'src/components/chat/useInbox.js',
  'src/components/chat/useMessageComposer.js',
  'src/components/chat/ConversationActions.jsx',
].map(file => normalizePath(path.resolve(__dirname, file))))

// Hook-only modules are not Refresh boundaries in this toolchain. Reload their
// consumers instead of reusing state with an obsolete hook order/dependency list.
const reloadChatHooks = {
  name: 'reload-chat-hook-changes',
  apply: 'serve',
  handleHotUpdate({ file, server }) {
    if (chatHookModules.has(normalizePath(file))) {
      server.ws.send({ type: 'full-reload', path: '*' })
      return []
    }
  },
}

// https://vite.dev/config/
export default defineConfig({
  build: { manifest: true },
  plugins: [react(), reloadChatHooks],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
