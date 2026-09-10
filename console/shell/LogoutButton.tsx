/** Icon-only logout control (top-right). */

type Props = {
  onLogout: () => void;
};

export function LogoutButton({ onLogout }: Props) {
  return (
    <button
      type="button"
      className="icon-btn logout-btn"
      aria-label="Log out"
      title="Log out"
      onClick={onLogout}
    >
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none">
        <path
          d="M10 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h3"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <path
          d="M14 16l4-4-4-4M9 12h9"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
