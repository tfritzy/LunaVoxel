import React from "react";
import { useParams } from "react-router-dom";

export const PresenceIndicator = () => {
  const { projectId } = useParams<{ projectId: string }>();

  return null;
};
