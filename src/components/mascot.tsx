export function Mascot() {
  return (
    <div className="oioi-mascot" id="oioi-mascot" aria-label="OiOi">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/content/OiOi.svg"
        alt="OiOi"
        className="oioi-img"
        draggable={false}
        width={64}
        height={64}
      />
      <div className="oioi-bubble" aria-hidden="true">
        <span>OiOi</span>
      </div>
    </div>
  );
}
