export interface ConvertOptions {
    internalLinkBase?: string | null;
}
export declare function convert(source: string | string[], options?: ConvertOptions): string;
export declare const sb2md: typeof convert;
