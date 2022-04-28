import type { NextPage } from 'next'
import Head from 'next/head'
import Script from 'next/script'
import styles from '../styles/analysis.module.css'
import Footer from '../components/Footer.component'
import Navbar from '../components/Navbar.component'

const Analysis:NextPage = () => {
    return (
        <div>
            <Head>
                <title>TradingSage.com|Analysis</title>
                <meta name="description" content="Make market analysis and get price alerts straight to your mobile phone as phone calls or text messages" />
                <link rel="icon" href="/favicon.ico" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            </Head>
            <main>
                <Navbar/>
                <section className={styles.chartSection}>
                    <div className="tradingview-widget-container" style={{width: '100%', height: '100%'}}>
                        <div id="tradingview_b74d9" style={{width: '100%', height: '100%'}}></div>
                    </div>
                    <Script strategy='beforeInteractive' src={"https://s3.tradingview.com/tv.js"}></Script>
                    <Script id='chart-config' strategy="afterInteractive">
                        {
                            `new TradingView.widget({
                                "autosize": true,
                                "symbol": "BINANCE:BTCUSDT",
                                "timezone": "Etc/UTC",
                                "theme": "dark",
                                "style": "1",
                                "locale": "en",
                                "toolbar_bg": "#f1f3f6",
                                "enable_publishing": false,
                                "withdateranges": true,
                                "range": "YTD",
                                "hide_side_toolbar": false,
                                "allow_symbol_change": true,
                                "details": true,
                                "hotlist": true,
                                "calendar": true,
                                "studies": [
                                    "DoubleEMA@tv-basicstudies"
                                ],
                                "container_id": "tradingview_b74d9"
                            })`
                        }
                    </Script>
                </section>
                <div className={styles.priceAlertButnWrapper}>
                    <button>Set Alert</button>
                </div>
            </main>
            <Footer/>
        </div>
    )
}

export default Analysis