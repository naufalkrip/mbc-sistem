import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ListOrdered } from "lucide-react";
import { EmptyState } from "./EmptyState";
import { Loading } from "./Loading";

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => ReactNode;
  className?: string;
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  emptyTitle?: string;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  sortKey?: string;
  sortDirection?: "asc" | "desc" | null;
  onSort?: (key: string) => void;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  emptyMessage = "Belum ada data yang tersimpan.",
  emptyTitle = "Tidak ada data",
  rowKey,
  onRowClick,
  sortKey,
  sortDirection,
  onSort,
}: DataTableProps<T>) {
  return (
    <div className="table-wrapper">
      {loading ? (
        <Loading label="Memuat data..." />
      ) : data.length === 0 ? (
        <EmptyState title={emptyTitle} message={emptyMessage} />
      ) : (
        <>
          {/* Desktop & Tablet Table Scroll */}
          <div className="table-scroll table-desktop-view">
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((col) => {
                    const isSortable = Boolean(col.sortable);
                    const isCurrent = sortKey === col.key;
                    return (
                      <th
                        key={col.key}
                        className={`${col.className ?? ""} ${isSortable ? "th-sortable" : ""}`}
                        onClick={() => isSortable && onSort?.(col.key)}
                        style={isSortable ? { cursor: "pointer", userSelect: "none" } : undefined}
                        title={isSortable ? `Klik untuk mengurutkan ${col.header}` : undefined}
                      >
                        <div className="th-sort-wrapper">
                          <span>{col.header}</span>
                          {isSortable && (
                            <span className={`sort-icon-box ${isCurrent ? "active" : "idle"}`}>
                              {col.key === "divisi" ? (
                                <ListOrdered size={isCurrent ? 13 : 12} className={isCurrent ? "sort-arrow" : "sort-arrow-idle"} />
                              ) : isCurrent && sortDirection === "asc" ? (
                                <ArrowUp size={13} className="sort-arrow" />
                              ) : isCurrent && sortDirection === "desc" ? (
                                <ArrowDown size={13} className="sort-arrow" />
                              ) : (
                                <ArrowUpDown size={12} className="sort-arrow-idle" />
                              )}
                            </span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.map((row, index) => (
                  <tr key={rowKey(row)} onClick={() => onRowClick?.(row)} className={onRowClick ? "clickable" : ""}>
                    {columns.map((col) => (
                      <td key={col.key} className={col.className}>
                        {col.render ? col.render(row, index) : String((row as Record<string, unknown>)[col.key] ?? "-")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List View (< 640px) */}
          <div className="table-mobile-cards">
            {data.map((row, index) => {
              const actionCol = columns.find(
                (c) => c.key.toLowerCase().includes("aksi") || c.key.toLowerCase().includes("action")
              );
              const otherCols = columns.filter(
                (c) =>
                  c !== actionCol &&
                  c.key.toLowerCase() !== "no" &&
                  c.key.toLowerCase() !== "index"
              );

              return (
                <div
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={`mobile-data-card ${onRowClick ? "clickable" : ""}`}
                >
                  <div className="mobile-data-card-body">
                    {otherCols.map((col) => {
                      const rendered = col.render
                        ? col.render(row, index)
                        : String((row as Record<string, unknown>)[col.key] ?? "-");
                      return (
                        <div key={col.key} className="mobile-card-row">
                          <span className="mobile-card-label">{col.header}</span>
                          <div className="mobile-card-value">{rendered}</div>
                        </div>
                      );
                    })}
                  </div>
                  {actionCol && actionCol.render && (
                    <div className="mobile-data-card-actions" onClick={(e) => e.stopPropagation()}>
                      {actionCol.render(row, index)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}