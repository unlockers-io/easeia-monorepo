import { brandMarkSvg } from "@repo/social-image/brand";

const contentType = "image/svg+xml";

const Icon = () => new Response(brandMarkSvg(), { headers: { "Content-Type": contentType } });

export { contentType };

export default Icon;
