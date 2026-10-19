import { Check, Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface RecoveryCodesPanelProps {
  codes: string[];
  onDone: () => void;
}

/** Recovery codes are shown exactly once; the server keeps only keyed hashes of them. */
export function RecoveryCodesPanel({ codes, onDone }: RecoveryCodesPanelProps) {
  const [copied, setCopied] = useState(false);
  const text = `Sukoon Health recovery codes\nEach code works once.\n\n${codes.join('\n')}\n`;

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'sukoon-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <Alert tone="warning" title="Save your recovery codes now">
        If you lose your phone, each code lets you sign in once. They will not be shown again. Keep
        them somewhere safe, like a password manager.
      </Alert>
      <ul
        aria-label="Recovery codes"
        className="grid grid-cols-2 gap-2 rounded-[var(--radius-control)] border border-line bg-sand/60 p-4 font-mono text-sm"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => void copy()}>
          {copied ? (
            <Check className="size-4" aria-hidden="true" />
          ) : (
            <Copy className="size-4" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="secondary" size="sm" onClick={download}>
          <Download className="size-4" aria-hidden="true" />
          Download
        </Button>
      </div>
      <Button className="self-start" onClick={onDone}>
        I have saved my recovery codes
      </Button>
    </div>
  );
}
