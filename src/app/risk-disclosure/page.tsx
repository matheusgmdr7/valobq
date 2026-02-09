'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function RiskDisclosurePage() {
  const [brokerLogo, setBrokerLogo] = useState<string | null>(null)
  const [brokerName, setBrokerName] = useState<string>('VALOREN')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadBrokerData = async () => {
      try {
        let logoUrl: string | null = null
        let name: string | null = null
        if (supabase) {
          try {
            const { data: d1 } = await supabase.from('platform_settings').select('value').eq('key', 'broker_logo_dark').single()
            if (d1?.value) { logoUrl = d1.value as string; localStorage.setItem('broker_logo_dark', logoUrl) }
            else { const { data: d2 } = await supabase.from('platform_settings').select('value').eq('key', 'broker_logo').single(); if (d2?.value) { logoUrl = d2.value as string; localStorage.setItem('broker_logo', logoUrl) } }
            const { data: d3 } = await supabase.from('platform_settings').select('value').eq('key', 'broker_name').single()
            if (d3?.value) { name = d3.value as string; localStorage.setItem('broker_name', name) }
          } catch { /* fallback */ }
        }
        if (!logoUrl) logoUrl = localStorage.getItem('broker_logo_dark') || localStorage.getItem('broker_logo')
        if (!name) name = localStorage.getItem('broker_name')
        if (logoUrl) setBrokerLogo(logoUrl)
        if (name) setBrokerName(name)
      } catch { /* ignore */ }
    }
    loadBrokerData()
  }, [])

  return (
    <div ref={scrollRef} className="h-screen w-full overflow-y-auto overflow-x-hidden bg-[#060b18] text-white scroll-smooth">
      <header className="sticky top-0 z-50 bg-[#060b18]/90 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {brokerLogo ? <img src={brokerLogo} alt={brokerName} className="h-7 object-contain" /> : <span className="text-lg font-bold text-white">{brokerName}</span>}
          </Link>
          <Link href="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />Back
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Risk Disclosure</h1>
        <p className="text-gray-500 text-sm mb-12">Last updated: January 2025</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-gray-300 leading-relaxed [&_h2]:text-white [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-12 [&_h2]:mb-4 [&_h3]:text-white [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3 [&_strong]:text-white [&_ol]:space-y-3 [&_ul]:space-y-2 [&_li]:text-gray-400">

          <p>
            Before you (our client and/or prospective client) apply for a trading account with the Company and
            begin trading on financial markets, please review carefully the below list of risks in conjunction with
            the Terms &amp; Conditions.
          </p>

          {/* Risk Warning */}
          <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-6">
            <h2 className="!mt-0">Risk Warning</h2>
            <p>
              The financial products offered by the Company, including Contracts for Difference (&apos;CFDs&apos;) are
              complex financial products, most of which have no set maturity date. Therefore, a CFD position
              matures on the date you choose to close an existing open position. Trading CFDs carries a high
              level of risk, since the multiplier tool (leverage) can work both to your advantage and disadvantage.
            </p>
            <p>
              As a result, it may not be suitable for all investors because you may lose all your invested capital.
              <strong> You should not risk more capital than you are prepared to lose.</strong> Before trading you should
              understand the risks involved and take into account your level of experience. You should seek
              independent advice if necessary.
            </p>
          </div>

          {/* Introduction */}
          <h2>Introduction</h2>
          <p>
            This Risk Disclosure is intended to inform you of the general risks that exist in trading activities on
            our website and of dealing in the Financial Instruments offered by the Company. You must recognize
            that these risks entail a chance of losing money while trading. This disclosure is informational and
            must not be considered a list of all possible risks.
          </p>
          <p>
            Trading in the Financial Instruments offered through this website is <strong>VERY SPECULATIVE AND
            HIGHLY RISKY</strong> and may involve a risk of loss of all your investments. The products offered by the
            Company are categorized as high-risk complex Financial Instruments and are not suitable for all
            members of the general public but only for those investors who:
          </p>
          <ol className="list-decimal pl-5">
            <li>
              Are willing to assume the economic, legal and other risks involved. You should be aware of
              the risks inherent in trading in these Financial Instruments and be able to bear such risks.
            </li>
            <li>
              Are able to assume financially the loss of their entire investment amount, taking into
              consideration their personal finances, including resources and obligations.
            </li>
            <li>
              Possess the appropriate level of experience and/or knowledge of the specific Financial
              Instruments offered by the Company. It is important for you to ensure that any decision to
              engage in trading CFDs and other products offered by the Company, is made on an informed
              basis, and that you understand the nature of the CFDs/products offered and the extent of all
              the risks associated with CFDs and other products.
            </li>
            <li>
              Please note that CFDs are leveraged financial products and therefore, as such, trading in
              CFDs using the Company&apos;s &apos;multiplier&apos; (leverage) tool involves high risk of loss as price
              movements are influenced by the amount of multiplier (leverage) used. For more information,
              please refer to the Company&apos;s Order Execution Policy.
            </li>
          </ol>

          {/* Section 1 */}
          <h2>1. Risks Associated with Trading in Financial Instruments</h2>
          <p>
            The Financial Instruments offered by the Company derive their value from the performance of the
            underlying assets/markets. It is important therefore that you understand the risks associated with
            trading in the relevant underlying asset/market because movements in the performance of the
            underlying asset/market will affect the profitability of your trade.
          </p>
          <p>
            Information on the previous performance of Financial Instruments does not guarantee the same
            circumstances of its current and/or future performance. The use of historical data does not lead to a
            safe forecast.
          </p>
          <p>
            Trading in the Financial Instruments offered by the Company can put your capital at risk. These
            Financial Instruments are categorized as high risk complex products, and you may lose all or part of
            the amount invested. Trading in the Financial Instruments offered by the Company is not suitable for
            all categories of investors. Your investment decisions are subject to various markets, currency,
            economic, political, business risks etc., and will not necessarily be profitable. You acknowledge, and
            without any reservation accept, that the value of any investment in a Financial Instrument may vary
            either upwards or downwards. You acknowledge, and without any reservation accept, the existence
            of a substantial risk of incurring losses and damages as a result of the buying or selling of any
            Financial Instrument offered by the Company and acknowledge your intent to take such risk.
          </p>
          <p>
            The Company will not provide you with any investment recommendations or with any advice that is
            directly or indirectly connected with the trading of Financial Instruments, and you acknowledge that
            the services provided by us do not include investment advice. This includes guidance in relation to
            underlying assets, the market or specific trading strategies.
          </p>
          <p>
            You should note that the Company may provide you, from time to time, with useful information about
            relatable subjects created by third parties, BUT the Company does not approve or endorse this
            information and/or these tools. Such information may be indicative of trading trends or trading
            opportunities, and it should be understood that, by taking any actions as a result of this
            information/tools, you accept and understand that it can cause loss of all your capital. We don&apos;t
            accept liability for any such losses resulting from actions taken by you based on information and or
            tools produced by third parties.
          </p>
          <p>
            The Company may also provide, at its discretion, information, news, market commentary or any
            other information through its website, agents or platform, but when it does so, it is understood that
            the information is provided solely to enable you to make your own investment decisions and does
            not amount to investment advice. You accept that you are solely responsible for the trades you make
            and that any transaction you enter into is done so based on your own judgment.
          </p>

          <h3>Market Risk</h3>
          <p>
            Due to the high volatility of the Market, prices of most Financial Instruments traded can
            vary considerably over the course of a day, which may bring you profit as well as loss. Those
            Financial Instruments with volatile price movements should be carefully considered as there are
            higher risks of loss. Prices may fluctuate due to changes in market conditions which are beyond your
            control and that of the Company, and it may not be possible for trades to be executed at the declared
            prices resulting in losses. The volatility of the market can be affected by, but is not limited to,
            changes in the supply &amp; demand, national &amp; international policy, geopolitical instability and
            economical/political events or announcements.
          </p>

          <h3>Liquidity Risk</h3>
          <p>
            This is the financial risk that for a certain period of time an underlying asset cannot
            be traded quickly enough in the market without impacting the market price. You must acknowledge
            that some products offered by the Company may suffer from liquidity strains due to adverse market
            conditions, and as such, the asset may be volatile and have a higher degree of risk. The volatility
            may be reflected in a larger spread between the ASK and BID prices, resulting in a change in the
            price of the product.
          </p>

          <h3>OTC/Counterparty Risk</h3>
          <p>
            Financial Instruments offered by the Company are Over-the-counter
            (OTC) or off-exchange traded. This means the trading is done directly between two parties, without
            any supervision of an exchange. The Company sets the conditions for trading according to its
            obligations to provide the best execution for our clients.
          </p>
          <p>
            OTC/Counterparty risk is the risk that, as there is no exchange market, the derivative transaction
            may not be closed out of an Open position. Prices quoted are established by dealers, which
            consequently make it difficult to ensure fair pricing to assess exposure to risk.
          </p>

          <h3>Foreign Exchange Risk</h3>
          <p>
            If a Financial Instrument is traded in a currency other than the currency of
            your account, changes in exchange rate may affect the value of the transaction negatively, resulting
            in financial losses.
          </p>

          {/* Section 2 */}
          <h2>2. Risks Associated with Trading in CFDs on Cryptocurrencies</h2>
          <ol className="list-decimal pl-5">
            <li>
              The CFDs on Cryptocurrency Services are not suitable for all investors. The CFDs on
              Cryptocurrency Services are highly complex and, as such, Clients must always make sure
              that they are fully aware and understand the specific characteristics and risks regarding the said
              CFDs on Cryptocurrency Services and have extensive knowledge and/or expertise of the
              CFDs on Cryptocurrency Services and of the underlying assets of the financial instruments
              offered by the CFDs on Cryptocurrency Services.
            </li>
            <li>
              Trading on financial instruments offered by the CFDs on Cryptocurrency Services carries a
              high risk of losing all your invested capital in your trading account and/or in a specific trade.
            </li>
            <li>
              Trading prices of the financial instruments and underlying assets offered by the CFDs on
              Cryptocurrency Services carry high volatility and thereby can widely fluctuate or become
              temporarily or permanently unavailable; therefore, Clients should trade carefully and only
              with funds that they can afford to lose.
            </li>
            <li>
              The nature of Cryptocurrencies may lead to an increased risk of fraud or cyber-attack, and
              may mean that technological difficulties experienced by the Company may prevent the
              access to or use of the CFDs on Cryptocurrency Services.
            </li>
            <li>
              The financial instruments offered by the CFDs on Cryptocurrency Services have specific
              distinct risks from financial instruments offered by the Company with underlying assets,
              currencies or commodities. Unlike most currencies, which are backed by governments or
              other legal entities, or by commodities such as gold or silver, Cryptocurrencies are a unique
              kind of currencies, backed by technology and trust. There is no central bank that can take
              corrective measures to protect the value of Cryptocurrencies in a crisis or issue more
              currency.
            </li>
          </ol>

          {/* Section 3 */}
          <h2>3. Risks Associated with Trading in Cryptocurrencies</h2>
          <p>
            Virtual currencies are complex and high-risk products and as such, you could lose your entire
            invested capital.
          </p>
          <p>
            Virtual currencies can widely fluctuate and may result in significant loss over a short period of time.
            You should not trade in virtual currencies in case you do not have the necessary knowledge and
            expertise in these products.
          </p>

          {/* Section 4 */}
          <h2>4. Technical Risks</h2>
          <ol className="list-decimal pl-5">
            <li>
              We are not responsible for financial losses arising from failure, malfunction, interruption,
              disconnection or malicious actions of information, communication, electricity, electronic or
              other systems, which are not the result of gross negligence or willful default of the Company.
            </li>
            <li>
              When working with the client terminal, you assume the risks arising from:
              <ol className="list-[lower-alpha] pl-5 mt-2">
                <li>Failures in your equipment, software, and connection;</li>
                <li>Errors in your client terminal settings;</li>
                <li>Failure to update your version of the client terminal in a timely manner;</li>
                <li>Your failure to follow the instructions for using the client terminal.</li>
              </ol>
              <p className="mt-2">
                We are not responsible for errors that occur in the operation of the client terminal,
                and will not compensate for losses resulting from errors in the operation of the client
                terminal.
              </p>
              <p>
                You must understand that any third-party attacks against the Company&apos;s Systems,
                which result in disruption of services or loss of funds, are not the responsibility of the
                Company and any liability for resulting losses will not be compensated by the
                Company. The Company ensures to take all reasonable measures to deflect such
                attacks and provide you with a secure and smooth trading experience.
              </p>
            </li>
            <li>
              You must understand that when concluding transactions over the phone, you may encounter
              difficulty getting through to an operator, especially during peak times. It should be noted that
              currently, the Company does not accept orders over the phone.
            </li>
            <li>
              You must understand that the unencrypted information transmitted by e-mail is not protected
              from any unauthorized access.
            </li>
            <li>
              You may suffer financial losses caused by the materialization of the above-mentioned risks,
              and you understand that you shall be responsible for all related losses that you may suffer,
              assuming that these are not owed to the Company&apos;s gross negligence or willful default.
            </li>
          </ol>

          {/* Section 5 */}
          <h2>5. Abnormal Market Risks</h2>
          <ol className="list-decimal pl-5">
            <li>
              You agree that if market conditions become abnormal, the amount of time required to
              process your orders and/or instructions may increase. Additionally, you agree that orders
              may not be executed at declared prices, and there is a chance that they may not be
              executed at all.
            </li>
            <li>
              Abnormal market conditions include but are not limited to times of rapid price movements,
              rises or falls in the same trading session to such an extent that, under the rules of the
              relevant exchange, trading is suspended or restricted, or there is lack of liquidity, or this may
              occur at the opening of trading sessions.
            </li>
          </ol>

          {/* Section 6 */}
          <h2>6. Risks Associated With the Laws Of Certain Governments</h2>
          <ol className="list-decimal pl-5">
            <li>
              You also assume responsibility for trading and non-trading operations performed within
              countries where they are restricted or prohibited by law.
            </li>
            <li>
              Laws regarding financial trading and contracts may be different throughout the world. It is
              your obligation to make certain that the use of our services is fully compliant with any law,
              regulation or directive applicable in your country of residence.
            </li>
            <li>
              The ability to access our website or any related website found from a link on our website
              does not mean that our services or any related activities are legal under the laws of your
              country of residence. These services should not be used by anyone in any jurisdiction in
              which these services are not authorized or unlawful. All users are required and responsible
              to check trading regulations related directly or indirectly to the Financial Instruments offered
              by the Company in their respective countries before registering at our trading platform.
            </li>
          </ol>

          {/* Section 7 */}
          <h2>7. Risks Associated With the Trading Platform</h2>
          <ol className="list-decimal pl-5">
            <li>
              All of your instructions are sent to our server and executed in order. Therefore, you cannot
              send a second order until your previous order has been executed. If a second order is
              received before the first is processed, the second order will be rejected. You assume
              responsibility for any unplanned trading operation that may be executed if you re-submit an
              order before being notified of the results of the first order.
            </li>
            <li>
              You must understand that closing the order window or position window does not cancel a
              submitted order.
            </li>
            <li>
              You acknowledge that only the quotes received from our server are authoritative. If there is a
              problem in the connection between your client terminal and our server, you can retrieve
              undelivered quote data from the client terminal&apos;s quote database.
            </li>
          </ol>

          {/* Section 8 */}
          <h2>8. Communication Risks</h2>
          <ol className="list-decimal pl-5">
            <li>
              You must be aware of the risk that information sent via unencrypted email may be accessed
              by unauthorized parties.
            </li>
            <li>
              We are not responsible for financial losses arising from delayed or failed receipt of a
              Company message.
            </li>
            <li>
              You are responsible for the security of the credentials for your Personal Area and trading
              accounts, as well as the confidential information that we send you. We are not responsible
              for financial losses arising from your disclosure of this information to third parties.
            </li>
          </ol>

          {/* Section 9 */}
          <h2>9. Force Majeure Events</h2>
          <ol className="list-decimal pl-5">
            <li>
              We are not responsible for financial losses arising from force majeure events. These events
              are extreme and irresistible circumstances that are independent of the will and actions of the
              agreement participants, that cannot be foreseen, prevented, or eliminated, including but not
              limited to natural disasters, fires, man-made accidents and disasters, emergencies at utility
              works and on utility lines, DDoS attacks, riots, military actions, terrorist attacks, uprisings,
              civil unrest, strikes, and the regulatory acts of state and local government authorities.
            </li>
          </ol>

          {/* Section 10 */}
          <h2>10. Third-Party Risks</h2>
          <ol className="list-decimal pl-5">
            <li>
              It is understood that we will promptly place all funds received from clients into one or more
              segregated account(s) (denoted as &apos;clients&apos; accounts&apos;) with reliable financial institutions, such
              as a credit institution or a bank. It should be noted that, whilst we shall exercise due skill,
              care and diligence (in accordance with applicable laws) when selecting the financial
              institution in which your funds will be placed, the Company is unable to accept liability and
              responsibility for circumstances beyond our control and as such do not accept any liability or
              responsibility for any resulting losses to you as a result of the insolvency or any other
              comparable proceedings or failure of the financial institution where your money will be held.
            </li>
            <li>
              The financial institution, to which we will pass your money, may hold it in an omnibus
              account. Hence, in the event of the insolvency or any other comparable proceedings in
              relation to that financial institution, we may only have an unsecured claim against the
              financial institution on your behalf, and you will be exposed to the risk that the money
              received by us from the financial institution is insufficient to satisfy your claims.
            </li>
            <li>
              It is understood that we execute your orders on an own account basis, i.e. as principal to
              principal against you; we are the counterparty of all your transactions. For more information,
              please refer to our Order Execution Policy.
            </li>
          </ol>

          {/* Section 11 */}
          <h2>11. Conflicts of Interest</h2>
          <ol className="list-decimal pl-5">
            <li>
              When we deal with you as a client, our associates, relevant persons or some other persons
              connected with us may have an interest, relationship or arrangement that is in conflict with
              your interest as our client.
            </li>
            <li>
              Continuing from the above point, the following occurrences may give rise to a conflict of
              interest entailing a material risk of damage to the interests of one or more clients, as a result
              of providing investment services:
              <ul className="list-disc pl-5 mt-2">
                <li>We execute your orders as a principal, and our revenues are largely generated from your trading losses;</li>
                <li>We may pay inducements to third parties for the referral of new clients or clients&apos; trading.</li>
              </ul>
            </li>
          </ol>

          {/* Section 12 */}
          <h2>12. No Guarantees of Profit</h2>
          <p>We are unable to:</p>
          <ul className="list-disc pl-5">
            <li>Provide guarantees of profit or of avoiding losses when you trade in the Financial Instruments offered by the Company.</li>
            <li>Provide guarantees of the future performance of your trading account.</li>
            <li>Provide guarantees of any specific level of performance or guarantee that your investment decisions/strategies will yield profit or financial gain.</li>
            <li>You receive no such guarantees from us or from any of our affiliates or representatives.</li>
          </ul>

          <div className="border-t border-white/10 pt-8 mt-12">
            <p className="text-gray-600 text-xs">
              {brokerName} &copy; 2025 — All rights reserved. Sun Wave LLC. Lighthouse Trust Nevis Ltd, Suite 1, A.L. Evelyn Ltd Building, Main Street, Charlestown, Nevis. Company No. L 22402.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
