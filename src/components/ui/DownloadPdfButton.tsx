import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { useToast } from "../../contexts/ToastContext";

interface DownloadPdfButtonProps {
  onGenerate: () => Promise<void> | void;
  label?: string;
  variant?: "outline" | "primary" | "red";
  className?: string;
}

export function DownloadPdfButton({
  onGenerate,
  label = "PDF",
  className = "",
}: DownloadPdfButtonProps) {
  const { success, error } = useToast();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onGenerate();
      success("PDF berhasil dibuat.");
    } catch (e) {
      error(e instanceof Error ? e.message : "Gagal membuat PDF.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      className={`btn-red btn-box-badge ${className}`}
      onClick={handleClick}
      disabled={loading}
      title="Download PDF"
    >
      {loading ? (
        <Loader2 size={14} className="spin" />
      ) : (
        <>
          <FileText size={13} />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}