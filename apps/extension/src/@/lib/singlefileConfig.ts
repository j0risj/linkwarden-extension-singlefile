import { getStorageItem, setStorageItem } from "./utils.ts";
import {
  singlefileConfigSchema,
  singlefileConfigType,
} from "./validators/singlefileConfig.ts";

const SINGLEFILE_CONFIG_KEY = "linkwarden_singlefile_config";

export async function getSinglefileConfig(): Promise<singlefileConfigType> {
  const stored = await getStorageItem(SINGLEFILE_CONFIG_KEY);
  if (stored) {
    const parsed = singlefileConfigSchema.safeParse(JSON.parse(stored));
    if (parsed.success) return parsed.data;
  }
  return singlefileConfigSchema.parse({});
}

export async function saveSinglefileConfig(config: singlefileConfigType) {
  return await setStorageItem(SINGLEFILE_CONFIG_KEY, JSON.stringify(config));
}
