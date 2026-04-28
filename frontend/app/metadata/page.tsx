"use client";

import { Suspense } from "react";
import MetadataPage from "./MetadataPage";

export default function Page() {
  return (
    <Suspense>
      <MetadataPage />
    </Suspense>
  );
}