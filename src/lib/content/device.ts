import { z } from "zod";

export const DeviceSchema = z.enum(["phone", "desktop"]);
export type Device = z.infer<typeof DeviceSchema>;
