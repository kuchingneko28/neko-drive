import { FileArchive, FileAudio, FileCode, FileIcon, FileImage, FileText, FileVideo } from "lucide-react";

export type FileType = "image" | "video" | "audio" | "pdf" | "text" | "archive" | "code" | "other";

function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

export function getFileType(fileName: string): FileType {
  const ext = getFileExtension(fileName);

  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg"].includes(ext)) return "audio";
  if (["pdf"].includes(ext)) return "pdf";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "archive";
  if (["txt", "md"].includes(ext)) return "text";
  if (["json", "js", "ts", "tsx", "jsx", "html", "css", "py", "sh", "yml", "yaml", "c", "cpp", "h"].includes(ext))
    return "code";

  return "other";
}

export function getFileIcon(fileName: string) {
  const type = getFileType(fileName);

  switch (type) {
    case "image":
      return <FileImage className="h-4 w-4" />;
    case "video":
      return <FileVideo className="h-4 w-4" />;
    case "audio":
      return <FileAudio className="h-4 w-4" />;
    case "archive":
      return <FileArchive className="h-4 w-4" />;
    case "code":
      return <FileCode className="h-4 w-4" />;
    case "text":
    case "pdf":
      return <FileText className="h-4 w-4" />;
    default:
      return <FileIcon className="h-4 w-4" />;
  }
}

export function getFileIconColor(fileName: string): string {
  switch (getFileType(fileName)) {
    case "image":
      return "text-green-500";
    case "video":
      return "text-purple-500";
    case "audio":
      return "text-amber-500";
    case "archive":
      return "text-yellow-600";
    case "code":
    case "text":
    case "pdf":
      return "text-blue-500";
    default:
      return "text-muted-foreground";
  }
}

export function isFileEncrypted(iv?: string | null, salt?: string | null) {
  if (!iv || !salt) return false;
  const isHex = (str: string) => /^[0-9a-fA-F]{24,64}$/.test(str);
  const isAllZeros = (str: string) => /^0+$/.test(str);
  return isHex(salt) && !isAllZeros(salt) && isHex(iv) && !isAllZeros(iv);
}
