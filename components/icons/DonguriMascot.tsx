"use client";

import * as React from "react";
import { motion, type SVGMotionProps } from "framer-motion";

type DonguriMascotProps = Omit<
  SVGMotionProps<SVGSVGElement>,
  "ref" | "children"
>;

const LOOP_DURATION = 6;

const DonguriMascot = (props: DonguriMascotProps) => {
  const titleId = React.useId();
  const descriptionId = React.useId();

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1224 1285"
      role="img"
      aria-labelledby={`${titleId} ${descriptionId}`}
      {...props}
    >
      <title id={titleId}>Donguri acorn character</title>

      <desc id={descriptionId}>
        A cute acorn character bouncing, waving and blinking.
      </desc>

      <motion.g
        animate={{
          y: [0, -14, 0, -5, 0, 0],
          scaleX: [1, 0.992, 1.012, 0.998, 1, 1],
          scaleY: [1, 1.012, 0.986, 1.004, 1, 1],
        }}
        transition={{
          duration: LOOP_DURATION,
          ease: "easeInOut",
          repeat: Infinity,
          times: [0, 0.07, 0.14, 0.2, 0.26, 1],
        }}
        style={{
          transformBox: "fill-box",
          transformOrigin: "center bottom",
        }}
      >
        <g stroke="#562b16" strokeLinecap="round" strokeLinejoin="round">
          {/* Enthusiastic wave after the bounce */}
          <motion.path
            fill="#FFE8C4"
            strokeWidth={14}
            d="M304 657c-39-23-75-22-105 0-28 21-21 54 3 76s58 29 98 15Z"
            animate={{
              rotate: [0, 0, -18, 16, -20, 17, -18, 14, -10, 0, 0],
            }}
            transition={{
              duration: LOOP_DURATION,
              ease: "easeInOut",
              repeat: Infinity,
              times: [
                0, 0.33, 0.38, 0.43, 0.48, 0.53, 0.58, 0.63, 0.68, 0.73, 1,
              ],
            }}
            style={{
              transformBox: "fill-box",
              transformOrigin: "right center",
            }}
          />

          {/* Body and legs */}
          <path
            fill="#FFE8C4"
            strokeWidth={15}
            d="M411 355c-61 59-105 139-127 238-28 121-15 273 35 390 22 51 59 96 110 126-10 43-5 78 18 97 24 20 65 11 81-34 81 19 176 20 259 8 3 41 19 63 45 67 34 5 56-20 63-75 26-9 47-17 67-27 37 18 76 25 113 18-20-25-33-46-41-70 53-85 70-189 60-304-14-161-67-320-163-419-148-46-366-51-520-15Z"
          />

          {/* Acorn cap */}
          <path
            fill="#DFA05A"
            strokeWidth={15}
            d="M384 368c-47-21-47-59-33-97 31-85 120-153 221-172 28-5 53-8 78-8l-7-41c-3-22 9-30 36-31h20c27 1 36 12 31 34l-11 45c105 4 199 48 252 121 36 49 56 111 15 148-42 38-134 46-303 46-152 0-252-16-299-45Z"
          />

          <path
            fill="#DFA05A"
            strokeWidth={14}
            d="m648 107-11-59c-4-22 12-31 41-31h23c26 1 37 12 32 34l-13 57"
          />

          <path
            fill="none"
            strokeWidth={12}
            d="M515 173c95 15 237 17 331 5M444 238c128 31 346 33 474 7M418 309c149 40 388 42 520 8"
          />

          {/* Face */}
          <ellipse
            cx={348}
            cy={608}
            fill="#FFF0C9"
            strokeWidth={13}
            rx={108}
            ry={112}
          />

          {/* Left blinking eye */}
          <motion.circle
            cx={466}
            cy={500}
            r={17}
            fill="#3d2014"
            stroke="none"
            animate={{
              scaleY: [1, 1, 0.08, 1, 1, 0.08, 1, 1],
              scaleX: [1, 1, 1.18, 1, 1, 1.18, 1, 1],
            }}
            transition={{
              duration: LOOP_DURATION,
              repeat: Infinity,
              times: [0, 0.76, 0.79, 0.82, 0.87, 0.9, 0.93, 1],
            }}
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
          />

          {/* Right blinking eye */}
          <motion.circle
            cx={574}
            cy={541}
            r={18}
            fill="#3d2014"
            stroke="none"
            animate={{
              scaleY: [1, 1, 0.08, 1, 1, 0.08, 1, 1],
              scaleX: [1, 1, 1.18, 1, 1, 1.18, 1, 1],
            }}
            transition={{
              duration: LOOP_DURATION,
              repeat: Infinity,
              times: [0, 0.76, 0.79, 0.82, 0.87, 0.9, 0.93, 1],
            }}
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
            }}
          />

          <circle
            cx={273}
            cy={548}
            r={55}
            fill="#3B548D"
            stroke="#202845"
            strokeWidth={13}
          />

          <path
            fill="none"
            strokeWidth={13}
            d="M730 799c16 41 51 69 78 72 29 3 47-38 18-82"
          />

          <path fill="none" strokeWidth={10} d="M129 535c-19 20-22 45-11 67" />

          <path fill="none" strokeWidth={9} d="M161 551c-14 16-15 36-7 52" />
        </g>
      </motion.g>
    </motion.svg>
  );
};

export default DonguriMascot;
