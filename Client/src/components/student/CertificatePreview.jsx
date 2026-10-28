import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BadgeCheck, Download, FileCheck2, Info, LoaderCircle, Maximize2, Printer, ZoomIn } from "lucide-react";
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
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState("");
  const printImage = useRef(null);
  const printPending = useRef(false);
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
    setPrintError("");
    setAttempt((value) => value + 1);
  };

  const printCertificate = async () => {
    if (!ready || error || printPending.current || !printImage.current) return;
    printPending.current = true;
    setPrinting(true);
    setPrintError("");
    const image = printImage.current;
    try {
      // The print copy mounts after the preview loads; wait for its own decode
      // so an immediate click cannot open a blank print preview.
      await image.decode();
      if (!image.isConnected || printImage.current !== image) return;
      window.print();
    } catch {
      if (image.isConnected) setPrintError("Unable to prepare the certificate for printing. Please try again.");
    } finally {
      printPending.current = false;
      if (image.isConnected) setPrinting(false);
    }
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
        <div className="certificate-preview-document">
          <span className="certificate-preview-verified"><BadgeCheck size={15} />Confirmed participation</span>
          <span className="certificate-preview-number" title={certificate.certificateNumber}>ID: {certificate.certificateNumber}</span>
        </div>
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
        <div className="certificate-preview-help"><Info size={17} /><p>Keep a copy of your achievement.<span>Choose <strong>Save as PDF</strong> in the print dialog for a PDF copy.</span></p></div>
        <div className="certificate-preview-actions">
          {ready && !error ? <a href={url} download={`${certificate.certificateNumber}.svg`} className="certificate-preview-action"><Download size={16} />Download SVG</a> : <button type="button" disabled className="certificate-preview-action"><Download size={16} />Download SVG</button>}
          <button type="button" disabled={!ready || !!error || printing} onClick={printCertificate} className="certificate-preview-action is-primary">{printing ? <LoaderCircle size={16} className="animate-spin" /> : <Printer size={16} />}{printing ? "Preparing print…" : "Print / Save as PDF"}</button>
        </div>
        {printError && <p role="alert" className="certificate-preview-print-error">{printError}</p>}
      </footer>
      {ready && !error && createPortal(
        <div className="digital-certificate-print">
          <style media="print">{"@page { size: A4 landscape; margin: 10mm; }"}</style>
          <img ref={printImage} src={url} alt={`Certificate for ${certificate.recipientName}`} />
        </div>,
        document.body,
      )}
    </FeedDialog>
  );
}
