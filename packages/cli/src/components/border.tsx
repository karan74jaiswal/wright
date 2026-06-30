export const EmptyBorder = {
  topLeft: "",
  topRight: "",
  bottomLeft: "",
  bottomRight: "",
  horizontal: "",
  topT: "",
  bottomT: "",
  rightT: "",
  leftT: "",
  vertical: "",
  cross: "",
};

export const SplitBorder = {
  border: ["left", "right"],
  customBorderChars: {
    ...EmptyBorder,
    vertical: "┃",
  },
};
