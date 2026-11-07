import React from "react";
import { MessageCircle, Eye, Camera, Pencil, Trash2 } from "lucide-react";
import type { Anggota } from "../../types";
import { toWaLink, isValidPhotoUrl } from "../../utils/format";
import { getMemberPhoto } from "../../services/photoStorage";
import { StatusBadge } from "../ui/StatusBadge";
import { ActionDropdown } from "../ui/ActionDropdown";

interface AnggotaMobileCardProps {
  member: Anggota;
  index: number;
  onEdit: (a: Anggota) => void;
  onDelete: (a: Anggota) => void;
  onDetail: (a: Anggota) => void;
  onOpenPhoto: (url: string | undefined, title: string, fileName?: string, id?: string) => void;
  toastError?: (msg: string) => void;
}

// Palet gradien avatar elegan & modern khas MBC Sistem
const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #b91c1c 0%, #dc2626 100%)", // Merah MBC Brand
  "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)", // Royal Blue
  "linear-gradient(135deg, #047857 0%, #10b981 100%)", // Emerald Green
  "linear-gradient(135deg, #6d28d9 0%, #8b5cf6 100%)", // Purple
  "linear-gradient(135deg, #c2410c 0%, #f97316 100%)", // Deep Orange
  "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)", // Teal
  "linear-gradient(135deg, #be185d 0%, #ec4899 100%)", // Rose
  "linear-gradient(135deg, #334155 0%, #475569 100%)", // Slate Dark
];

function getAvatarGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

function getInitials(name: string): string {
  if (!name) return "MB";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function AnggotaMobileCard({
  member,
  index: _index,
  onEdit,
  onDelete,
  onDetail,
  onOpenPhoto,
  toastError,
}: AnggotaMobileCardProps) {
  const rawPhoto = member.foto || getMemberPhoto(member.id, member.nama);
  const photoUrl = isValidPhotoUrl(rawPhoto) ? rawPhoto : undefined;

  const handlePhotoClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (photoUrl) {
      onOpenPhoto(photoUrl, `Pas Foto: ${member.nama}`, `${member.nama}.jpg`, member.id);
    }
  };

  const handleViewFullPhoto = () => {
    if (photoUrl) {
      onOpenPhoto(photoUrl, `Pas Foto: ${member.nama}`, `${member.nama}.jpg`, member.id);
    } else if (toastError) {
      toastError(`Anggota ${member.nama} belum memiliki pas foto.`);
    }
  };

  return (
    <div
      className="pddikti-member-card compact-member-card"
      id={`anggota-card-${member.id}`}
      onClick={() => onDetail(member)}
      style={{ cursor: "pointer" }}
    >
      <div className="compact-card-inner">
        {/* Avatar with click to open photo */}
        <div className="pddikti-avatar-wrap" onClick={handlePhotoClick}>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={member.nama}
              className="pddikti-avatar-img"
              loading="lazy"
              title={`Klik untuk memperbesar pas foto ${member.nama}`}
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
                const fallback = (e.target as HTMLElement).nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = "flex";
              }}
            />
          ) : null}
          <div
            className="pddikti-avatar-initial"
            style={{
              background: getAvatarGradient(member.nama),
              display: photoUrl ? "none" : "flex",
            }}
            title={member.nama}
          >
            {getInitials(member.nama)}
          </div>
        </div>

        {/* Center: Info */}
        <div className="compact-card-info">
          <div className="compact-card-name-row">
            <span className="compact-card-name">{member.nama}</span>
            {member.namaPanggilan ? (
              <span className="compact-card-nickname">({member.namaPanggilan})</span>
            ) : null}
          </div>

          <div className="compact-card-meta-row">
            <span className="compact-card-dept">{member.divisi || "-"}</span>
            {member.jabatan && <span className="compact-card-role">• {member.jabatan}</span>}
          </div>

          {member.noHp && (
            <div className="compact-card-contact-row" onClick={(e) => e.stopPropagation()}>
              <a
                href={toWaLink(member.noHp)}
                target="_blank"
                rel="noopener noreferrer"
                className="compact-wa-link"
                title={`Hubungi via WhatsApp (${member.noHp})`}
              >
                <MessageCircle size={12} className="pddikti-wa-icon" />
                <span>{member.noHp}</span>
              </a>
            </div>
          )}
        </div>

        {/* Right: Badge & Actions */}
        <div className="compact-card-actions-col" onClick={(e) => e.stopPropagation()}>
          <StatusBadge value={member.status} />
          <div className="compact-card-dropdown-wrap">
            <ActionDropdown
              variant="minimal"
              items={[
                { label: "Detail", icon: <Eye size={13} />, onClick: () => onDetail(member) },
                {
                  label: "Lihat Foto Full",
                  icon: <Camera size={13} style={{ color: "var(--primary-700, #b91c1c)" }} />,
                  onClick: handleViewFullPhoto,
                },
                { label: "Edit", icon: <Pencil size={13} />, onClick: () => onEdit(member) },
                { label: "Hapus", icon: <Trash2 size={13} />, onClick: () => onDelete(member), danger: true },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
