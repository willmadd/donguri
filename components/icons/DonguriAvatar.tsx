import Image from "next/image";
import DonguriMascot from "@/components/icons/DonguriMascot";
import { ACCESSORIES, type AccessoryId } from "@/lib/levels";

type DonguriAvatarProps = {
  equippedAccessory: AccessoryId | string | null | undefined;
  className?: string;
};

// The costume images (public/costumes/*.webp) are full standalone
// illustrations of the character already wearing that one accessory, not
// transparent overlays — so "equipping" one just swaps which image renders,
// falling back to the plain animated mascot when nothing is equipped.
export function DonguriAvatar({ equippedAccessory, className }: DonguriAvatarProps) {
  const accessory = ACCESSORIES.find((candidate) => candidate.id === equippedAccessory);

  if (!accessory) {
    return <DonguriMascot className={className} />;
  }

  return (
    <Image
      src={accessory.image}
      alt={`Donguri wearing ${accessory.label}`}
      width={1224}
      height={1285}
      className={className}
    />
  );
}
