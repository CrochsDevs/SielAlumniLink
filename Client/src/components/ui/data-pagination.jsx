import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Reusable table pagination: page buttons + Radix rows-per-page select.
// Props: page (1-based), totalPages, onPageChange, perPage, onPerPageChange,
//        totalItems, itemLabel.
const DataPagination = ({
  page,
  totalPages,
  onPageChange,
  perPage,
  onPerPageChange,
  totalItems,
  itemLabel = "items",
}) => {
  if (totalItems === 0) return null;

  const start = (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, totalItems);

  // Compact page numbers with ellipsis.
  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "…") {
      pages.push("…");
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-zinc-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11.5px] text-zinc-500">
        Showing{" "}
        <span className="font-bold text-zinc-800">
          {start}–{end}
        </span>{" "}
        of <span className="font-bold text-zinc-800">{totalItems}</span>{" "}
        {itemLabel}
      </p>

      <div className="flex items-center gap-2">
        <Select
          value={String(perPage)}
          onValueChange={(v) => onPerPageChange(Number(v))}
        >
          <SelectTrigger className="h-8 w-[70px] text-[11.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[5, 10, 20, 50].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} / page
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {pages.map((p, i) =>
            p === "…" ? (
              <span
                key={`gap-${i}`}
                className="px-1 text-[11.5px] text-zinc-400"
              >
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? "default" : "ghost"}
                size="icon"
                className={`h-8 w-8 text-[12px] ${p === page ? "bg-[#009639] hover:bg-[#007a2e]" : ""}`}
                onClick={() => onPageChange(p)}
              >
                {p}
              </Button>
            ),
          )}
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DataPagination;
