import { Image } from "react-native";

const MARK = require("../../assets/images/logo-mark.png");
const FULL = require("../../assets/images/logo-full.png");

/** Width / height of each image, so the logo keeps its proportions. */
const RATIO = { mark: 369 / 480, full: 720 / 625 } as const;

/**
 * The SafeMaman logo, exact colours. `mark` is the drawing alone (fits a size × size box);
 * `full` adds the SAFEMAMAN wordmark and is `size` wide.
 */
export function Logo({ size = 88, variant = "mark" }: { readonly size?: number; readonly variant?: "mark" | "full" }) {
  const full = variant === "full";
  return (
    <Image
      source={full ? FULL : MARK}
      style={full ? { width: size, height: size / RATIO.full } : { width: size * RATIO.mark, height: size }}
      resizeMode="contain"
      accessibilityLabel="SafeMaman"
      accessibilityRole="image"
    />
  );
}
