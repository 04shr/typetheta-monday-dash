import React, { useState } from "react";

interface TypeThetaLogoProps {
  className?: string;
  height?: number;
  variant?: "light" | "dark";
}

export default function TypeThetaLogo({ 
  className = "", 
  height = 36,
  variant = "light"
}: TypeThetaLogoProps) {
  const [imageError, setImageError] = useState(false);
  const logoUrl = "https://typetheta.co.uk/wp-content/uploads/2024/07/TypeTheta.png";

  if (imageError) {
    const purpleColor = variant === "dark" ? "#FFFFFF" : "#7B0099";
    const orangeColor = "#F59E0B";

    return (
      <div className={`inline-flex items-center select-none ${className}`}>
        <svg
          height={height}
          viewBox="0 0 260 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-auto max-w-full"
          style={{ height: `${height}px` }}
        >
          <text
            x="0"
            y="44"
            fill={purpleColor}
            fontFamily="Plus Jakarta Sans, Inter, sans-serif"
            fontWeight="800"
            fontSize="46"
            letterSpacing="-1.5px"
          >
            type
          </text>
          <g transform="translate(94, 2)">
            <path
              d="M 12 44 C 5 44 2 36 4 26 C 6 15 14 5 24 3 C 30 1 34 5 32 11 C 29 19 19 32 12 41 C 10 44 12 46 17 46 C 26 46 33 37 36 26 C 39 16 37 7 28 3 C 20 -2 10 2 5 12 C 0 22 1 34 8 42 C 14 48 23 48 30 43 C 35 39 40 31 39 23 C 39 13 31 4 21 4 C 11 4 3 13 1 23"
              fill="none"
              stroke={orangeColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
          <text
            x="146"
            y="44"
            fill={orangeColor}
            fontFamily="Plus Jakarta Sans, Inter, sans-serif"
            fontWeight="800"
            fontSize="46"
            letterSpacing="-1.5px"
          >
            heta
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center select-none ${className}`}>
      <img
        src={logoUrl}
        alt="TypeTheta Logo"
        referrerPolicy="no-referrer"
        onError={() => setImageError(true)}
        style={{ height: `${height}px`, width: "auto" }}
        className={`object-contain ${
          variant === "dark" ? "brightness-0 invert drop-shadow" : ""
        }`}
      />
    </div>
  );
}






