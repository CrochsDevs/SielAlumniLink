import { useEffect, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";
import { Bold, Italic, Underline, List, ListOrdered, Link, Unlink, Undo2, Redo2, RemoveFormatting } from "lucide-react";
import { descriptionHtml } from "./description";
import "./OpportunityEditor.css";

export default function OpportunityEditor({ value, format, onChange, disabled }) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [linkError, setLinkError] = useState("");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, codeBlock: false, code: false, horizontalRule: false, link: { openOnClick: false, defaultProtocol: "https" } }),
      Placeholder.configure({ placeholder: "Describe the role, responsibilities, qualifications, and benefits…" }),
      CharacterCount.configure({ limit: 10000 }),
    ],
    content: descriptionHtml(value, format),
    editorProps: { attributes: { id: "career-description", role: "textbox", "aria-label": "Description", "aria-multiline": "true", class: "opportunity-prose opportunity-input" } },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? "" : current.getHTML()),
  });
  const state = useEditorState({ editor, selector: ({ editor: current }) => current ? {
    bold: current.isActive("bold"), italic: current.isActive("italic"), underline: current.isActive("underline"),
    bulletList: current.isActive("bulletList"), orderedList: current.isActive("orderedList"), link: current.isActive("link"),
    heading: current.isActive("heading", { level: 2 }) ? "2" : current.isActive("heading", { level: 3 }) ? "3" : "p",
    undo: current.can().undo(), redo: current.can().redo(), count: current.storage.characterCount.characters(),
  } : null });
  useEffect(() => { editor?.setEditable(!disabled); }, [editor, disabled]);
  if (!editor || !state) return null;
  const control = (label, Icon, action, active, unavailable = false) => (
    <button key={label} type="button" title={label} aria-label={label} aria-pressed={active} disabled={disabled || unavailable}
      onMouseDown={(event) => event.preventDefault()} onClick={action} className="opportunity-tool"><Icon size={16} aria-hidden="true" /></button>
  );
  const applyLink = () => {
    const href = /^(https?:\/\/|mailto:)/i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
    try {
      const parsed = new URL(href);
      if (!url.trim() || /\s/.test(href) || !["http:", "https:", "mailto:"].includes(parsed.protocol) || (parsed.protocol !== "mailto:" && !parsed.hostname.includes("."))) throw new Error();
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
      setLinkOpen(false);
      setLinkError("");
    } catch { setLinkError("Enter a valid website or email link."); }
  };
  return <div>
    <label htmlFor="career-description" className="block text-xs font-medium">Description</label>
    <div className="opportunity-editor mt-1.5" aria-disabled={disabled}>
      <div className="opportunity-toolbar" role="group" aria-label="Description formatting">
        <select aria-label="Text style" value={state.heading} disabled={disabled} onChange={(event) => event.target.value === "p" ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number(event.target.value) }).run()}>
          <option value="p">Normal text</option><option value="2">Heading</option><option value="3">Subheading</option>
        </select>
        {control("Bold", Bold, () => editor.chain().focus().toggleBold().run(), state.bold)}
        {control("Italic", Italic, () => editor.chain().focus().toggleItalic().run(), state.italic)}
        {control("Underline", Underline, () => editor.chain().focus().toggleUnderline().run(), state.underline)}
        {control("Bullet list", List, () => editor.chain().focus().toggleBulletList().run(), state.bulletList)}
        {control("Numbered list", ListOrdered, () => editor.chain().focus().toggleOrderedList().run(), state.orderedList)}
        {control("Insert or edit link", Link, () => { setUrl(editor.getAttributes("link").href || ""); setLinkError(""); setLinkOpen(!linkOpen); }, state.link)}
        {control("Remove link", Unlink, () => editor.chain().focus().unsetLink().run(), undefined, !state.link)}
        {control("Clear formatting", RemoveFormatting, () => editor.chain().focus().unsetAllMarks().clearNodes().run())}
        {control("Undo", Undo2, () => editor.chain().focus().undo().run(), undefined, !state.undo)}
        {control("Redo", Redo2, () => editor.chain().focus().redo().run(), undefined, !state.redo)}
      </div>
      {linkOpen && <div className="opportunity-link">
        <label htmlFor="opportunity-link-url">Link address</label>
        <div className="flex flex-wrap gap-2">
          <input id="opportunity-link-url" autoFocus value={url} placeholder="https://example.com" onChange={(event) => setUrl(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); applyLink(); } if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setLinkOpen(false); editor.commands.focus(); } }} />
          <button type="button" onClick={applyLink}>Apply</button><button type="button" onClick={() => { setLinkOpen(false); editor.commands.focus(); }}>Cancel</button>
        </div>
        {linkError && <p role="alert" className="text-red-600">{linkError}</p>}
      </div>}
      <EditorContent editor={editor} />
      <div className="opportunity-editor-footer"><span>Tip: select text to format it.</span><span>{state.count.toLocaleString()} / 10,000</span></div>
    </div>
  </div>;
}
