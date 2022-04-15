import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import Script from 'next/script'
import Navbar from '../components/Navbar.component'
import styles from '../styles/Home.module.css'

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>TradingSage.com</title>
        <meta name="description" content="Make market analysis and get price alerts straight to your mobile phone as phone calls or text messages" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={styles.main}>
        <Navbar/>
        <Script strategy='beforeInteractive' src={"https://s3.tradingview.com/tv.js"}></Script>
        <section id='banner'>
          <div className={styles.blocker}>
          
          </div>
          <div className={styles.cover}>
            <h1>TradingSage.com</h1>
          </div>
          <div className="tradingview-widget-container">
            <div id="tradingview_b74d9"></div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <a
          href="https://vercel.com?utm_source=create-next-app&utm_medium=default-template&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          Powered by{' '}
          <span className={styles.logo}>
            <Image src="/vercel.svg" alt="Vercel Logo" width={72} height={16} />
          </span>
        </a>
      </footer>
      <Script strategy='afterInteractive'>
        {
        `
        new TradingView.MediumWidget({
        "symbols": [
            [
            "BTCUSDT",
            "BINANCE:BTCUSDT|1D"
            ]
        ],
        "chartOnly": false,
        "width": "100%",
        "height": "100%",
        "locale": "en",
        "colorTheme": "dark",
        "gridLineColor": "rgba(240, 243, 250, 0)",
        "fontColor": "#787B86",
        "isTransparent": false,
        "autosize": true,
        "showVolume": false,
        "scalePosition": "no",
        "scaleMode": "Normal",
        "fontFamily": "-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
        "noTimeScale": false,
        "valuesTracking": "2",
        "chartType": "line",
        "color": "rgba(41, 98, 255, 1)",
        "container_id": "tradingview_b74d9"
        });
      `}
        
      </Script>
    </div>
  )
}

export default Home
