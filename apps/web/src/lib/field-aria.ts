export const fieldAria = (name: string, hasDescription: boolean, isInvalid: boolean) => {
  const descriptionId = `${name}-description`;
  const errorId = `${name}-error`;

  const describedBy = [hasDescription ? descriptionId : null, isInvalid ? errorId : null]
    .filter((id) => id !== null)
    .join(" ");

  return { describedBy: describedBy === "" ? undefined : describedBy, descriptionId, errorId };
};
