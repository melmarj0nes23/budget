import React from 'react';
import { SourceCitation, VerificationStatus } from '../types/civic';

interface BadgeProps {
  status: VerificationStatus;
}

export const VerificationBadge: React.FC<BadgeProps> = ({ status }) => {
  if (status === 'Verified') {
    return null;
  }

  const config: Record<
    Exclude<VerificationStatus, 'Verified'>,
    { cls: string; icon: string; label: string }
  > = {
    'Needs Review': {
      cls: 'verify-tag--review',
      icon: 'bi-info-circle',
      label: 'Pending LGU Confirmation',
    },
    Outdated: { cls: 'verify-tag--outdated', icon: 'bi-clock-history', label: 'Outdated' },
    Unavailable: {
      cls: 'verify-tag--unavailable',
      icon: 'bi-slash-circle-fill',
      label: 'Unavailable',
    },
  };

  const { cls, icon, label } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-[3px] font-mono-ed text-[10px] uppercase tracking-[0.12em] whitespace-nowrap ${
        status === 'Unavailable'
          ? 'border-ed-red/30 bg-ed-red/5 text-ed-red'
          : 'border-ed-rule-strong bg-ed-paper-2 text-ed-ink-2'
      } ${cls}`}
      title={`Verification status: ${label}`}
    >
      <i className={`bi ${icon}`} aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

interface CitationBoxProps {
  citation: SourceCitation;
  compact?: boolean;
}

export const SourceCitationBox: React.FC<CitationBoxProps> = ({ citation, compact = false }) => {
  return (
    <div className="mt-6 border border-ed-rule bg-ed-paper-2 p-4 text-xs text-ed-ink-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-mono-ed text-[10px] uppercase tracking-[0.14em] text-ed-ink-3 mr-2">
            Source
          </span>
          <a
            href={citation.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-ed-navy hover:underline"
          >
            {citation.sourceTitle} <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
          </a>
        </div>
        <VerificationBadge status={citation.verificationStatus} />
      </div>
      {!compact && (
        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 border-t border-ed-rule pt-2.5 font-mono-ed text-[11px] text-ed-ink-3">
          <span>
            <strong className="text-ed-ink-2 font-medium">Agency:</strong> {citation.issuingAgency}
          </span>
          <span>
            <strong className="text-ed-ink-2 font-medium">Published:</strong> {citation.publicationDate}
          </span>
          <span>
            <strong className="text-ed-ink-2 font-medium">Last Verified:</strong> {citation.lastVerified}
          </span>
        </div>
      )}
      {citation.notes && <p className="mt-2 mb-0 text-xs text-ed-ink-2">{citation.notes}</p>}
    </div>
  );
};
