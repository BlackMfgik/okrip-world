export function DiscordLoginButton() {
  // Native GET navigation starts OAuth without Next.js prefetching the one-time state.
  return (
    <form action="/v1/auth/discord/start" method="get">
      <button type="submit" className="btn btn-primary">
        Авторизуватись через Discord
      </button>
    </form>
  );
}

