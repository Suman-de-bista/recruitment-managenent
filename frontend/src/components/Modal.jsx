export default function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-[2px]">
      <div className="w-full max-w-lg rounded-lg border border-hairline bg-surface p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-serif text-lg font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-ink-faint transition-colors hover:bg-accent-soft hover:text-ink"
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
