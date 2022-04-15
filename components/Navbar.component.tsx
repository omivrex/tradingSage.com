import { ReactElement } from "react";
import Link from "next/link";
const Navbar = ():ReactElement => {
  return (
    <nav>
      <Link href="./" passHref={true}>
        <span id="appName">TradingSage.com</span>
      </Link>
    </nav>
  )
}
export default Navbar