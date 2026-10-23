import { toast } from "https://kit.thatsit.app/kit.js";
import { html } from "https://kit.thatsit.app/lit.js";

// @ts-expect-error guards the paths mapping: a missing export must be a type error
import { notAKitExport } from "https://kit.thatsit.app/kit.js";

console.log(html`<p>app</p>`, notAKitExport);
toast("Hello");
