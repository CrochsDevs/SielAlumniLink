import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Printer } from "lucide-react";
import { FeedDialog } from "../feed/FeedComposer";
import api from "../../utils/axios";
import "./CertificatePreview.css";

export default function CertificatePreview({ certificate, onClose }) {
  const [url, setUrl] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true,
      objectUrl;
    api
      .get(`/certificates/${certificate._id}/download`, {
        responseType: "blob",
      })
      .then((response) => {
        objectUrl = URL.createObjectURL(response.data);
        if (active) {
          setUrl(objectUrl);
          setError("");
        } else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active)
          setError("Unable to load the certificate. Please try again.");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [certificate._id, attempt]);
  return (
    <FeedDialog wide title="Certificate preview" onClose={onClose}>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}{" "}
          <button
            type="button"
            onClick={() => setAttempt((value) => value + 1)}
            className="underline"
          >
            Retry
          </button>
        </p>
      )}
      {!url && !error && (
        <p role="status" className="p-8 text-center text-sm text-zinc-500">
          Loading certificate...
        </p>
      )}
      {url && (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[11px] text-zinc-500">
              {certificate.certificateNumber}
            </p>
            <div className="flex flex-wrap gap-2">
              <a
                href={url}
                download={`${certificate.certificateNumber}.svg`}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-200 px-3 text-xs font-semibold dark:border-zinc-700"
              >
                <Download size={14} />
                Download SVG
              </a>
              <button
                type="button"
                disabled={!ready}
                onClick={() => window.print()}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#009639] px-3 text-xs font-semibold text-white"
              >
                <Printer size={14} />
                Print / Save as PDF
              </button>
            </div>
          </div>
          <img
            src={url}
            alt={`Certificate of participation awarded to ${certificate.recipientName} for ${certificate.title}`}
            onLoad={() => setReady(true)}
            className="w-full rounded-lg border border-zinc-200 bg-white"
          />
          <p className="mt-3 text-[11px] leading-6 text-zinc-500">
            Issued from confirmed participation. Choose Save as PDF in the print
            dialog for a PDF copy.
          </p>
          {createPortal(
            <div className="digital-certificate-print">
              <style media="print">
                {"@page { size: A4 landscape; margin: 10mm; }"}
              </style>
              <img
                src={url}
                alt={`Certificate for ${certificate.recipientName}`}
              />
            </div>,
            document.body,
          )}
        </>
      )}
    </FeedDialog>
  );
}
