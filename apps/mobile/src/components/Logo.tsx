import { Image } from "react-native";

const MARK = require("../../assets/images/logo-mark.png");

/** The SafeMaman mark: a mother holding a heart. Fits a size × size box. */
export function Logo({ size = 88 }: { readonly size?: number }) {
  return (
    <Image
      source={MARK}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel="SafeMaman"
      accessibilityRole="image"
    />
  );
}
