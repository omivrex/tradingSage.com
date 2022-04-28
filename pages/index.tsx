import type { NextPage } from 'next'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import Script from 'next/script'
import Footer from '../components/Footer.component'
import Navbar from '../components/Navbar.component'
import styles from '../styles/Home.module.css'
import { useSession, signIn } from "next-auth/react"
const Home: NextPage = () => {
  const { data: session } = useSession()
  console.log(session)
  return (
    <div className={styles.container}>
      <Head>
        <title>TradingSage.com</title>
        <meta name="description" content="Make market analysis and get price alerts straight to your mobile phone as phone calls or text messages" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      </Head>
      <main className={styles.main}>
        <Navbar/>
        <Script id='tradingViewScript1' strategy='beforeInteractive' src={"https://s3.tradingview.com/tv.js"}></Script>
        <section id='banner'>
          <div className={styles.cover}>
            <h1>TradingSage.com</h1>
            <h3 className={styles.description}>Perform market analysis and get price alerts straight to your phone as calls or text messages</h3>
            <Link passHref={true} href={'/analysis'}>
              <button>Get Started</button>
            </Link>
          </div>
          <div className="tradingview-widget-container">
            <div id="tradingview_b74d9"></div>
          </div>
        </section>
        <section className={styles.about}>
          <h3>
            Perform Analysis with our state of the art tools
          </h3>
          <div className={styles.widgets}>
            <div>
              <span>Add custom widgets to your dashboard help improve your analysis</span>
              <img src="chartImg.jpg" alt="" />
            </div>
            <div>
              <span>Use the speediometer to compare your analysis to that of your fellow traders</span>
              <img src="speediometer.jpg" alt="" />
            </div>
            <div>
              <span>Get real time price updates on all pairs. From your favourite currency pairs to crypto pairs</span>
              <img src="marketOverview.jpg" alt="" />
            </div>
          </div>
        </section>
      </main>
      <Footer/>
      <Script id='chart-config' strategy='afterInteractive'>
        {
        `
        new TradingView.MediumWidget({
        "symbols": [
            [
            "BTCUSDT",
            "BINANCE:BTCUSDT|1D"
            ]
        ],
        "chartOnly": true,
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
        "chartType": "area",
        "color": "rgba(41, 98, 255, 1)",
        "container_id": "tradingview_b74d9"
        });
      `}
      </Script>
    </div>
  )
}

export default Home
