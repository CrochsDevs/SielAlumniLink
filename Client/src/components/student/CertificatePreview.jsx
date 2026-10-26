import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, FileCheck2, LoaderCircle, Maximize2, Printer, ZoomIn } from "lucide-react";
import { FeedDialog } from "../feed/FeedComposer";
import api from "../../utils/axios";
import "./CertificatePreview.css";

export default function CertificatePreview(props) {
  return <CertificatePreviewContent key={props.certificate._id} {...props} />;
}

function CertificatePreviewContent({ certificate, onClose }) {
  const [url, setUrl] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  useEffect(() => {
    let active = true, objectUrl;
    const controller = new AbortController();
    api.get(`/certificates/${certificate._id}/download`, {
      responseType: "blob",
      signal: controller.signal,
    }).then((response) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(response.data);
      setUrl(objectUrl);
    }).catch(() => {
      if (active) setError("Unable to load the certificate. Please try again.");
    });
    return () => {
      active = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [certificate._id, attempt]);

  const retry = () => {
    setUrl(null);
    setReady(false);
    setError("");
    setZoomed(false);
    setAttempt((value) => value + 1);
  };

  return (
    <FeedDialog
      wide
      className="certificate-preview-dialog"
      title="Certificate preview"
      onClose={onClose}
      header={
        <div className="certificate-preview-heading">
          <span className="certificate-preview-icon"><FileCheck2 size={22} /></span>
          <div>
            <p className="certificate-preview-title">Certificate preview</p>
            <p className="certificate-preview-recipient" title={`${certificate.recipientName} · ${certificate.title}`}>
              {certificate.recipientName} · {certificate.title}
            </p>
          </div>
        </div>
      }
    >
      <div className="certificate-preview-toolbar">
        <span className="certificate-preview-number" title={certificate.certificateNumber}>{certificate.certificateNumber}</span>
        <button
          type="button"
          disabled={!ready || !!error}
          onClick={() => setZoomed((value) => !value)}
          className="certificate-preview-zoom"
          aria-pressed={zoomed}
          aria-controls="certificate-preview-canvas"
        >
          {zoomed ? <Maximize2 size={15} /> : <ZoomIn size={15} />}
          {zoomed ? "Fit to screen" : "Zoom in"}
        </button>
      </div>
      <div id="certificate-preview-canvas" className={`certificate-preview-stage${zoomed ? " is-zoomed" : ""}`} aria-busy={!ready && !error}>
        {error ? (
          <div className="certificate-preview-status" role="alert">
            <FileCheck2 size={30} />
            <p>{error}</p>
            <button type="button" onClick={retry} className="certificate-preview-action">Retry</button>
          </div>
        ) : (
          <>
            {!ready && <div role="status" className="certificate-preview-status"><LoaderCircle size={26} className="animate-spin" /><p>Loading certificate...</p></div>}
            {url && <img
              src={url}
              alt={`Certificate of appreciation awarded to ${certificate.recipientName} for ${certificate.title}`}
              onLoad={() => setReady(true)}
              onError={() => { setReady(false); setError("Unable to display the certificate. Please try again."); }}
              className={`certificate-preview-image${ready ? "" : " is-loading"}`}
              draggable={false}
            />}
          </>
        )}
      </div>
      <footer className="certificate-preview-footer">
        <p>For a PDF copy, choose <strong>Save as PDF</strong> in the print dialog.</p>
        <div className="certificate-preview-actions">
          {ready && !error && <a href={url} download={`${certificate.certificateNumber}.svg`} className="certificate-preview-action"><Download size={16} />Download SVG</a>}
          <button type="button" disabled={!ready || !!error} onClick={() => window.print()} className="certificate-preview-action is-primary"><Printer size={16} />Print / Save as PDF</button>
        </div>
      </footer>
      {ready && !error && createPortal(
        <div className="digital-certificate-print">
          <style media="print">{"@page { size: A4 landscape; margin: 10mm; }"}</style>
          <img src={url} alt={`Certificate for ${certificate.recipientName}`} />
        </div>,
        document.body,
      )}
    </FeedDialog>
  );
}
