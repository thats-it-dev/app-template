// Dynamic imports, because a failed static import can't be caught and would leave a blank page.
try {
	const [kit] = await Promise.all([import("https://kit.thatsit.app/kit.js"), import("./app-main.ts")]);
	kit.trackViewport();
	if (import.meta.env.PROD && "serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
} catch {
	const p = document.createElement("p");
	p.textContent = "Couldn't load the kit. Check your connection and reload.";
	document.body.replaceChildren(p);
}
