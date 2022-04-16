import styles from '../styles/footer.module.css'
import { ReactElement } from 'react'
import Link from 'next/link'
import { BsFacebook } from 'react-icons/bs';
import { SiGmail } from 'react-icons/si';
import { IoLogoWhatsapp, IoLogoTwitter, IoLogoLinkedin } from 'react-icons/io';

const Footer = ():ReactElement => {
    return ( 
      <footer className={styles.footer}>
        <h1>Desinged By Rex Omiv</h1>
        <p>
          I am a fullstack web and mobile developer.
          <br />
          I currently works as a freelance developer, I&lsquo;am focused on building applications for my clients that will gives them the satisfaction they deserve.
          <br/>
          TradingSage.com is one of my web application.
        </p>
        <section className={styles.contactInfo}>
          <Link href={'mailto:omivrex@gmail.com'} passHref={true}>
            <span>
              <SiGmail size={'40%'} color={'#ff5722'}/>
            </span>
          </Link>
          <Link href={'https://web.facebook.com/rex.omivii'} passHref={true}>
            <span>
              <BsFacebook size={'40%'} color={'#0164b3'}/>
            </span>
          </Link>
          <Link href={'https://wa.me/+2347084973294'} passHref={true}>
            <span>
              <IoLogoWhatsapp size={'40%'} color={'#4caf50'}/>
            </span>
          </Link>
          <Link href={'https://twitter.com/RexOmiv'} passHref={true}>
            <span>
              <IoLogoTwitter size={'40%'} color={'#0164b3'}/>
            </span>
          </Link>
          <Link href={'https://linkedin.com/in/Rex-Omiv'} passHref={true}>
            <span>
              <IoLogoLinkedin size={'40%'} color={'#0164b3'}/>
            </span>
          </Link>
        </section>
      </footer>
     );
}
 
export default Footer;