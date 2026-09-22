import Image from "next/image";

interface DiscordAvatarProps {
  name: string;
  url: string | null;
}

export function DiscordAvatar({ name, url }: DiscordAvatarProps) {
  return (
    <div className="admin-discord-avatar" aria-hidden="true">
      {url ? (
        <Image alt="" height={38} src={url} unoptimized width={38} />
      ) : (
        <span className="admin-discord-avatar-fallback">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}
