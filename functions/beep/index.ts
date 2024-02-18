export const onRequest: PagesFunction = async (context) => {
  const upgradeHeader = context.request.headers.get("Upgrade");
  if (!upgradeHeader || upgradeHeader !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  return fetch(`https://beep-api.jamjaws.com/beep`, {
    headers: { Upgrade: "websocket" },
  });
};
