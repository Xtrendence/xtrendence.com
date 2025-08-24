import { Text } from "@chakra-ui/react";

export function TopBar() {
  return (
    <div className="w-full px-4 h-16 bg-black/80 flex items-center justify-between">
      <Text
        style={{
          fontFamily: "Compacta, sans-serif",
          fontSize: "1.5rem",
          fontWeight: 800,
        }}
      >
        Clicker
      </Text>
    </div>
  );
}
