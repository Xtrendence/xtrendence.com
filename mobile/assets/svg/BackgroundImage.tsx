import * as React from 'react';
import Svg, {
  Rect,
  Defs,
  RadialGradient,
  Stop,
  LinearGradient,
  Path,
  G,
  Use,
  Circle,
  SvgProps,
} from 'react-native-svg';

const BackgroundImage = (props: SvgProps) => (
  <Svg viewBox="0 0 2000 1500" {...props}>
    <Rect fill="#CA93CE" width={2000} height={1500} />
    <Defs>
      <RadialGradient id="a" gradientUnits="objectBoundingBox">
        <Stop offset={0} stopColor="#170F2B" />
        <Stop offset={1} stopColor="#CA93CE" />
      </RadialGradient>
      <LinearGradient
        id="b"
        gradientUnits="userSpaceOnUse"
        x1={0}
        y1={750}
        x2={1550}
        y2={750}>
        <Stop offset={0} stopColor="#71517d" />
        <Stop offset={1} stopColor="#CA93CE" />
      </LinearGradient>
      <Path
        id="s"
        fill="url(#b)"
        d="M1549.2 51.6c-5.4 99.1-20.2 197.6-44.2 293.6c-24.1 96-57.4 189.4-99.3 278.6c-41.9 89.2-92.4 174.1-150.3 253.3c-58 79.2-123.4 152.6-195.1 219c-71.7 66.4-149.6 125.8-232.2 177.2c-82.7 51.4-170.1 94.7-260.7 129.1c-90.6 34.4-184.4 60-279.5 76.3C192.6 1495 96.1 1502 0 1500c96.1-2.1 191.8-13.3 285.4-33.6c93.6-20.2 185-49.5 272.5-87.2c87.6-37.7 171.3-83.8 249.6-137.3c78.4-53.5 151.5-114.5 217.9-181.7c66.5-67.2 126.4-140.7 178.6-218.9c52.3-78.3 96.9-161.4 133-247.9c36.1-86.5 63.8-176.2 82.6-267.6c18.8-91.4 28.6-184.4 29.6-277.4c0.3-27.6 23.2-48.7 50.8-48.4s49.5 21.8 49.2 49.5c0 0.7 0 1.3-0.1 2L1549.2 51.6z"
      />
      <G id="g">
        <Use href="#s" transform="scale(0.12) rotate(60)" />
        <Use href="#s" transform="scale(0.2) rotate(10)" />
        <Use href="#s" transform="scale(0.25) rotate(40)" />
        <Use href="#s" transform="scale(0.3) rotate(-20)" />
        <Use href="#s" transform="scale(0.4) rotate(-30)" />
        <Use href="#s" transform="scale(0.5) rotate(20)" />
        <Use href="#s" transform="scale(0.6) rotate(60)" />
        <Use href="#s" transform="scale(0.7) rotate(10)" />
        <Use href="#s" transform="scale(0.835) rotate(-40)" />
        <Use href="#s" transform="scale(0.9) rotate(40)" />
        <Use href="#s" transform="scale(1.05) rotate(25)" />
        <Use href="#s" transform="scale(1.2) rotate(8)" />
        <Use href="#s" transform="scale(1.333) rotate(-60)" />
        <Use href="#s" transform="scale(1.45) rotate(-30)" />
        <Use href="#s" transform="scale(1.6) rotate(10)" />
      </G>
    </Defs>
    <G transform="">
      <G transform="">
        <Circle fill="url(#a)" r={3000} />
        <G opacity={0.5}>
          <Circle fill="url(#a)" r={2000} />
          <Circle fill="url(#a)" r={1800} />
          <Circle fill="url(#a)" r={1700} />
          <Circle fill="url(#a)" r={1651} />
          <Circle fill="url(#a)" r={1450} />
          <Circle fill="url(#a)" r={1250} />
          <Circle fill="url(#a)" r={1175} />
          <Circle fill="url(#a)" r={900} />
          <Circle fill="url(#a)" r={750} />
          <Circle fill="url(#a)" r={500} />
          <Circle fill="url(#a)" r={380} />
          <Circle fill="url(#a)" r={250} />
        </G>
        <G transform="rotate(-25.2 0 0)">
          <Use href="#g" transform="rotate(10)" />
          <Use href="#g" transform="rotate(120)" />
          <Use href="#g" transform="rotate(240)" />
        </G>
        <Circle fillOpacity={0.1} fill="url(#a)" r={3000} />
      </G>
    </G>
  </Svg>
);

export default BackgroundImage;
