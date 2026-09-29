import { Img } from "react-email";

type LogoProps = {
  height?: number;
  width?: number;
};

const Logo = ({ height = 32, width = 120 }: LogoProps) => {
  return (
    <Img
      alt="Easeia"
      height={height}
      src="https://www.easeia.dev/logo-wordmark.svg"
      width={width}
    />
  );
};

export { Logo };
