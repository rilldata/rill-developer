import { extractFileExtension } from "$lib/util/extract-source-name";
import { FILE_EXTENSION_TO_SOURCE_TYPE } from "$lib/types";
import notifications from "$lib/components/notifications";
import { config } from "$lib/application-state-stores/application-store";

/**
 * uploadSourceFiles
 * --------
 * Attempts to upload all files passed in.
 * Will return the list of files that are not valid.
 */
export function uploadSourceFiles(files, apiBase: string) {
  const invalidFiles = [];
  const validFiles = [];

  [...files].forEach((file: File) => {
    const fileExtension = extractFileExtension(file.name);
    if (fileExtension in FILE_EXTENSION_TO_SOURCE_TYPE) {
      validFiles.push(file);
    } else {
      invalidFiles.push(file);
    }
  });

  validFiles.forEach((validFile) =>
    uploadFile(validFile, `${apiBase}/source-upload`)
  );
  return invalidFiles;
}

export function uploadFile(file: File, url: string) {
  const formData = new FormData();
  formData.append("file", file);

  fetch(url, {
    method: "POST",
    body: formData,
  })
    .then((...args) => console.error(...args))
    .catch((...args) => console.error(...args));
}

function reportFileErrors(invalidFiles: File[]) {
  notifications.send({
    message: `${invalidFiles.length} file${
      invalidFiles.length !== 1 ? "s are" : " is"
    } invalid: \n${invalidFiles.map((file) => file.name).join("\n")}`,
    options: {
      width: 400,
    },
  });
}

/** Handles the uploading of the datasets. Any invalid files will be reported
 * through reportFileErrors.
 */
export function handleFileUploads(filesArray: File[]) {
  let invalidFiles = [];
  if (filesArray) {
    invalidFiles = uploadSourceFiles(
      filesArray,
      `${config.server.serverUrl}/api`
    );
  }
  if (invalidFiles.length) {
    reportFileErrors(invalidFiles);
  }
}

/** a drag and drop callback to kick off a source import */
export function onSourceDrop(e: DragEvent) {
  const files = e?.dataTransfer?.files;
  if (files) {
    handleFileUploads(Array.from(files));
  }
}

/** an event callback when a source file is chosen manually */
export function onManualSourceUpload(e: Event) {
  const files = (<HTMLInputElement>e.target)?.files as FileList;
  if (files) {
    handleFileUploads(Array.from(files));
  }
}

export async function uploadFilesWithDialog() {
  const input = document.createElement("input");
  input.multiple = true;
  input.type = "file";
  input.onchange = onManualSourceUpload;
  input.click();
}
