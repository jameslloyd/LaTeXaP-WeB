import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { ConflictResolutionChoice, ProjectConflictInfo } from '@shared/types';

export interface ConflictResolutionBannerProps {
  conflictInfo: ProjectConflictInfo;
  onResolve: (choice: ConflictResolutionChoice) => Promise<void>;
}

export const ConflictResolutionBanner: React.FC<ConflictResolutionBannerProps> = ({
  conflictInfo,
  onResolve,
}) => {
  const [resolving, setResolving] = useState(false);

  const handleResolve = async (choice: ConflictResolutionChoice) => {
    setResolving(true);
    try {
      await onResolve(choice);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="studio-banner studio-banner--danger" role="alert" aria-live="assertive">
      <div className="studio-banner__content">
        <AlertTriangle size={16} aria-hidden="true" />
        <span>
          <strong>Sync Conflict on &ldquo;{conflictInfo.slug}&rdquo;:</strong> Cloud version is{' '}
          <code>v{conflictInfo.serverVersion}</code> (you edited from{' '}
          <code>v{conflictInfo.expectedVersion}</code>). Conflicting files:{' '}
          {conflictInfo.conflictFiles.join(', ')}.
        </span>
      </div>
      <div className="studio-banner__actions">
        {resolving && <Loader2 size={14} className="spin-icon" aria-hidden="true" />}
        <button
          type="button"
          className="btn btn-sm"
          disabled={resolving}
          onClick={() => void handleResolve('keep-both')}
        >
          Keep Both Copies
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={resolving}
          onClick={() => void handleResolve('keep-local')}
        >
          Keep My Local Version
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={resolving}
          onClick={() => void handleResolve('use-cloud')}
        >
          Use Cloud Version
        </button>
      </div>
    </div>
  );
};
