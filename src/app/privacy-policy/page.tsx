'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function PrivacyPolicyPage() {
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

  const supportEmail = 'suporte@valorenbroker.com'

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
        <h1 className="text-3xl sm:text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-12">Last updated: August 21, 2024</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-gray-300 leading-relaxed [&_h2]:text-white [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-12 [&_h2]:mb-4 [&_h3]:text-white [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mt-8 [&_h3]:mb-3 [&_strong]:text-white [&_ol]:space-y-3 [&_ul]:space-y-2 [&_li]:text-gray-400">

          <p>
            {brokerName} respects your privacy and is committed to protecting and respecting your
            personal data. This privacy policy aims to give you information on how we collect and process
            any personal data i.e. information about a Client (as defined below) who is a natural person on
            the basis of which that Client can be identified (hereinafter the data) in accordance with the
            applicable data protection legislation and best practice.
          </p>
          <p>
            We strive to create the most secure infrastructure of any broker in the world. In this privacy
            policy we would like to tell why you can trust us with your data and rest assured that your data is
            safe.
          </p>
          <p>
            It is important that you read this privacy policy together with any other privacy policy we may
            provide on specific occasions when we are collecting or processing your data about you so that
            you are fully aware of how and why we are using your data.
          </p>
          <p>
            In this Privacy Policy, unless the context otherwise requires, expressions defined herein shall
            have the meaning ascribed to them in the Terms &amp; Conditions.
          </p>
          <p>
            Please note that this Privacy Policy is addressed to current and prospective Clients. If you are
            an employee of Sun Wave, contractor or a third-party service provider, your personal
            information will be used in connection with your employment contract, your contractual
            relationship or in accordance with our separate policies which are available by contacting us at
            the contact details listed in the section OUR CONTACT DETAILS below.
          </p>
          <p>
            If you are participating in our affiliate program and/or introducing broker program, we will
            process the data provided under our agreement with you to exercise our rights and perform our
            obligations under or in connection with the relevant agreement and the term Client in this
            Privacy Policy shall be read to include the term affiliate and/or introducing broker (as
            applicable).
          </p>

          {/* 1. WHO WE ARE */}
          <h2>1. Who We Are</h2>
          <p>
            {brokerName} is a brand operated by Sun Wave LLC, a company registered in St. Kitts and
            Nevis with company registration number L 22402 and having its registered address at
            Lighthouse Trust Nevis Ltd, Suite 1, A.L. Evelyn Ltd Building, Main Street, Charlestown, Nevis
            (hereinafter &quot;Sun Wave&quot; and/or &quot;Company&quot;). Sun Wave is the controller and responsible for
            the data of the Client disclosed to us in order to register for a Trading Account, Demo Account
            and/or to make use of any other services offered by Sun Wave through the website (hereinafter
            &quot;Website&quot;) (this term shall at all times include Website&apos;s desktop and mobile versions).
          </p>
          <p>
            This Privacy Policy is issued on behalf of Sun Wave, the company responsible for collecting
            and/or processing your data when you use the Trading Platform through the Website, either for
            a Trading Account or a Demo Account (or their mobile/desktop versions) (hereinafter
            the Service(s)). In Sun Wave we respect your privacy and we are committed to protect your
            data, which we collect, use and/or have access to.
          </p>
          <p>
            The Company takes measures to implement advanced data protection policies and procedures
            and to update them from time to time for the purpose of safeguarding the Client&apos;s data and the
            Client&apos;s account. Your data is protected by the legal, administrative and technical measures that
            we take to ensure the privacy, integrity and accessibility of data. To prevent security incidents
            with your data, we use a mixed organizational and technical approach based on the results of
            annual risk assessment.
          </p>
          <p>
            The Company shall not divulge any private information of its Clients and former Clients unless
            the Client approves in writing such disclosure or unless such disclosure is required under
            applicable law or is required in order to verify the Client&apos;s identity or it is required for Sun Wave
            to perform its contractual obligations under any agreement concluded with the Client. The
            Clients&apos; information is processed only by the employees of the Company and/or trusted third
            parties which provide specific support services, dealing with the specific Client&apos;s Accounts and
            necessary for the provision of our services. All such information shall be stored on electronic
            and physical storage media according to applicable law.
          </p>

          {/* 2. DATA USAGE */}
          <h2>2. Data Usage</h2>
          <p>We may collect, use, store and transfer different kinds of data about you which we have grouped together as follows:</p>

          <ul className="list-disc pl-5 space-y-3">
            <li><strong>Identity Data</strong> includes first name, last name, and patronymic (if available), date of birth, gender, passport, ID, Driver&apos;s number, and copy of photo.</li>
            <li><strong>Contact Data</strong> includes billing address, email address and telephone numbers.</li>
            <li><strong>Financial Data</strong> includes bank account, payment card details and tax identification number (including but not limited to social security number, income tax identification number, national insurance number).</li>
            <li><strong>Transaction Data</strong> includes details about the transactions performed by you, details about payments, withdrawals, exchanges, trading history, profit, balance, deposited and withdrawal amount methods, and any other details in relation to the services you have made use of through our Website.</li>
            <li><strong>Technical Data</strong> includes internet protocol (IP) address, your login data, browser type and version, time zone setting and location, browser plug-in type and versions, operating system and platform, and other technologies on the devices you use to access the Website and use of cookies stored on your device.</li>
            <li><strong>Profile Data</strong> includes your Client&apos;s account details, username and password, transactions made by you, your interests, preferences, feedback and/or information received through your interaction with us within the course of providing our services and survey responses.</li>
            <li><strong>Usage Data</strong> includes information about how you use the Website, products and services, registration date, account category, trading cluster, number of complaints, number of requests filed and IP history.</li>
            <li><strong>Marketing and Communication Data</strong> includes your preferences in receiving marketing from us and your communication preferences.</li>
            <li><strong>Special Categories of Data / &apos;Sensitive&apos; Data</strong> includes details about your religious belief, annual income, biometric data and/or criminal convictions and offenses.</li>
            <li><strong>Conformity Data</strong> includes details about your education, employment status, trading experience, self-assessment test.</li>
            <li><strong>Banking Data</strong> includes details of the number of payment wallets and/or information of your bank card, including information of the issuing bank, card number, cardholder name, card expiration date, payment system, card validation code (CVV2 / CVC2), and photos of both sides of the bank card.</li>
            <li><strong>Data in KYC (Know Your Customer)</strong> includes identity document information, including copies of recently dated Utility Bills, Identity Card, Passport, and/or Driver&apos;s License.</li>
            <li><strong>Economic Profile Data</strong> includes details on occupation, purpose of investment, annual income, net wealth, expected annual amount of investment and sources of funds.</li>
            <li><strong>Location Data</strong> includes details on your actual location when interacting with our Website (for example, a set of parameters that determine regional settings of your interface, namely residency country, time zone, and the interface language).</li>
            <li><strong>Audio Data</strong> includes full voice recordings of calls that you receive from us or make to us.</li>
          </ul>
          <p className="text-gray-500 text-xs border-l-2 border-white/10 pl-4">(the above collectively referred to as Personal Data)</p>

          <p>
            <strong>Aggregated Data</strong> includes statistical or demographic data for any purpose. Such data can be
            derived from your data but may not be considered personal data in law as it will not directly or
            indirectly reveal your identity. An example of such Aggregated Data could be that we aggregate
            your Usage Data to calculate the percentage of users accessing a specific website feature
            and/or services/product preference.
          </p>
          <p>
            Notwithstanding the above, if Sun Wave combines Aggregate Data with data in a way that the
            end result can in any way identify the data subject, Sun Wave shall treat such combined data as
            data which will be treated as per the provisions herein contained.
          </p>
          <p>
            Processing of your data is carried out by Sun Wave following the principles of lawfulness,
            fairness, transparency, and always adhering to the intended purpose of data processing, the
            principle of data minimization, accuracy, limited data storage, data integrity, confidentiality and
            accountability.
          </p>
          <p>In general Sun Wave collects and processes the Personal Data, for any of the following reasons:</p>
          <ol className="list-decimal pl-5">
            <li>To perform its contract with you,</li>
            <li>To comply with its legal obligations including without limitation to applicable anti-money laundering and terrorist financing laws and regulations (hereby referred to as Money-Laundering Law), and/or</li>
            <li>To safeguard its legitimate interest</li>
          </ol>
          <p>
            The Client acknowledges that all or part of the data concerning the Client&apos;s account and related
            transactions will be stored by Sun Wave and may be used by the Company in case of
            dispute between the Client and the Company.
          </p>
          <p>
            The Client is responsible for updating any data provided to us in case of any change. Although
            we will strive to keep your data up to date and review and inspect any information provided by
            you, we may not be able to always do so without your help. The Client acknowledges that Sun
            Wave holds neither commitment nor responsibility to the Client due to any aforesaid review or
            inspection of information.
          </p>

          {/* 3. HOW IS YOUR PERSONAL DATA COLLECTED */}
          <h2>3. How Is Your Personal Data Collected?</h2>
          <p>We use different methods to collect data from and about you including through:</p>

          <h3>Direct Interactions</h3>
          <p>
            You will provide to us your Identity, Contact and Financial Data online
            through the Website and/or by filling in online forms and/or by corresponding with us by emails
            or otherwise. Data may be submitted to us by you when you wish to:
          </p>
          <ol className="list-decimal pl-5">
            <li>Register for a Trading Account;</li>
            <li>Register for a Demo Account;</li>
            <li>Subscribe to our publications and ongoing updates;</li>
            <li>Request marketing and promotions to be sent to you;</li>
            <li>Enter a competition, promotion or survey; and/or</li>
            <li>Give us feedback or contact us.</li>
          </ol>
          <p>
            We require to collect the above data in order that we are able to (i) provide our services
            efficiently, (ii) to comply with our ongoing legal obligations, including, inter alia, to prevent fraud
            and money laundering acts.
          </p>
          <p>
            If you fail to provide the data when requested we may not be able to perform the contract we
            have or are trying to enter into with you (for example, to provide you with our services). In this
            case, we may have to cancel a service you have with us but we will notify you if this is the case
            at the time. It is important that the data we hold about you is accurate and current. Please keep
            us informed if your data changes during your relationship with us.
          </p>

          <h3>Automated Technologies or Interactions</h3>
          <p>
            When using our services, your device automatically transmits to us its technical characteristics. Locale
            (a set of parameters that determine regional settings of your interface, namely, residence country,
            time zone and the interface language) is used for the purpose of providing you with the best possible
            service within our platform. Using the information about IP address, cookies files, information about
            browser and operating system used, the date and time of access to the site, and the requested pages
            addresses allows us to provide you with the optimal operation on our web application, mobile and/or
            desktop versions of our application and monitor your behavior for the purpose of improving the
            efficiency and usability of our Services.
          </p>
          <p>
            We use web analytics tools to track performance of our website and marketing source of users by
            cookies in order to optimize our marketing costs and provide users with better experience. You may
            at any time request that we refrain from any such transmissions (to the degree this is possible and
            subject to any of our legal obligations) by sending your request to the support team at{' '}
            <strong>{supportEmail}</strong> using the registered email address you disclosed and registered with us
            through your Account. We will address your request within 30 business days.
          </p>

          <h3>About Cookies</h3>
          <p>
            A cookie is a small amount of data that often includes a unique identifier that is sent to your
            computer or device browser from a website&apos;s computer and is stored on your device&apos;s hard drive
            for tracking site usage. A website may send its own cookie to your browser if your browser&apos;s
            preferences allow it, but, to protect your privacy, your browser only permits a website to access
            the cookies it has already sent to you, not the cookies sent to you by other websites. Many
            websites do this whenever a user visits their website in order to track online traffic flows. When
            you visit our Website, our system automatically collects information about your visit, such as
            your Technical Data, including inter alia your browser type, your IP address and the referring
            website.
          </p>
          <p>
            Cookies stored may determine the path the Client took on our site and used to anonymously
            identify repeat users of the website and what pages were most popular for Clients. However, the
            Company protects the Client&apos;s privacy by not storing the Client&apos;s names, personal details,
            emails, etc. Using cookies is an industry standard and is currently used by most major websites.
            Stored cookies allow the Website to be more user-friendly and efficient for Clients by allowing
            Sun Wave to learn what information is more valued by Clients versus what isn&apos;t. You can set
            your browser not to save any cookies of this website and you may also delete cookies
            automatically or manually. However, please note that by doing so you may not be able to use all
            the provided functions of our website in full.
          </p>

          {/* 4. PURPOSE */}
          <h2>4. Purpose for Which We Will Use Your Data and on What Legal Basis</h2>
          <p>
            We process the aforementioned data in compliance with the applicable legislation as amended
            from time to time in order to (i) be able to perform our contractual obligations towards the Client
            and offer them the best possible service, (ii) provide our Services efficiently, (iii) comply with our
            legal obligations, including, inter alia, to prevent fraud and money laundering acts, and (iv)
            protect our legitimate interests and your vital interests.
          </p>
          <p>We process all data based on the following legal basis:</p>
          <ol className="list-decimal pl-5">
            <li>For compliance with our legal obligations;</li>
            <li>For the performance of our contractual obligations towards the Client;</li>
            <li>For the purposes of safeguarding our legitimate interests and your interests and fundamental rights do not override those interests; and/or</li>
            <li>On the basis of your consent.</li>
          </ol>

          <p>Indicatively we set out below a description of all the ways we plan to use your data:</p>

          <div className="space-y-6">
            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">a. Client Registration &amp; Communication</p>
              <p className="text-sm">To register you as a Client, notify you about changes to our terms or privacy policy, communicate with you and provide secure identification, authentication and support services, and confirm your age of majority.</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Identity, Profile, Contact, KYC, Financial, Economic Profile Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Performance of contract; Compliance with legal obligations</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">b. Scoring Processing</p>
              <p className="text-sm">To perform our Scoring Processing under which a Client is scored on a scale basis with regard to the level of risk.</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Banking Data, Economic Profile Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Performance of contract; Compliance with legal obligations</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">c. Location Confirmation</p>
              <p className="text-sm">To confirm the information provided by you in relation to your location.</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Location Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Performance of contract; Compliance with legal obligations</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">d. Authentication via Social Networks</p>
              <p className="text-sm">To secure authentication, identification and support services via social networks protocols.</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Technical Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Performance of contract; Compliance with legal obligations</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">e. Transaction Processing</p>
              <p className="text-sm">To process and deliver your transactions and requests (Deposits, Trades, Withdrawals), manage payments, fees and charges, and collect/recover money owed to us.</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Banking Data, Transaction Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Performance of contract; Legitimate interest (recover charges)</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">f. Business &amp; Website Administration</p>
              <p className="text-sm">To administer and protect our business and Website (including troubleshooting, data analysis, testing, system maintenance, support, reporting and hosting of data).</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Identity, Contact, Technical Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Performance of contract; Compliance with legal obligations; Legitimate interest (IT services, fraud prevention)</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">g. Content Delivery &amp; Advertising</p>
              <p className="text-sm">To deliver relevant Website content and advertisements to you, measure effectiveness of advertising, and monitor behavior for improving efficiency and usability.</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Identity, Contact, Profile, Usage, Technical, Marketing and Communication Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Performance of contract; Legitimate interest (product development, business growth)</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">h. Usage Analysis</p>
              <p className="text-sm">To study how customers use our products/services, to develop them, to grow our business, inform our marketing strategy, and for statutory limitations.</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Transaction Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Legitimate interest (including statutory limitations)</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">i. New Services &amp; Products Notification</p>
              <p className="text-sm">To inform you about new services/products we may offer and any new development and/or features of the current products/services.</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Identity, Profile, Contact, Technical, Usage, Transactions, Marketing and Communication Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Performance of contract; Legitimate interest (product development, business growth)</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">j. Direct Marketing</p>
              <p className="text-sm">To send direct marketing of our services, newsletters, push-messages and calls to keep you in touch with new features and developments. We will never use your data to communicate or promote any third party marketing material.</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Identity, Profile, Contact, Activity Data, Marketing and Communication Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Performance of contract; Legitimate interest (personalized customer service)</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">k. Analytics &amp; Optimization</p>
              <p className="text-sm">To allow us to provide you with the optimal operation on our Website and applications, monitor behavior for improving efficiency, and use analytics tools to track performance and optimize marketing costs.</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Location, Technical, Usage, Marketing and Communication Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Performance of contract; Legitimate interest (personalized customer service)</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">l. Employee Monitoring &amp; Dispute Resolution</p>
              <p className="text-sm">To allow us to monitor and train our employees for your benefit, safeguard interests in case of a dispute, take steps for fraud prevention, and improve services.</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Audio Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Performance of contract; Compliance with legal obligations; Legitimate interest</p>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
              <p className="text-white font-semibold mb-2">m. Income &amp; Background Verification</p>
              <p className="text-sm">To confirm that your annual income corresponds with your employment status and to confirm that you have no criminal history.</p>
              <p className="text-sm mt-2"><strong>Data used:</strong> Sensitive Data</p>
              <p className="text-sm mt-1 text-gray-500">Legal basis: Compliance with legal obligations; Protection of your vital interests</p>
            </div>
          </div>

          <p>
            If you are an existing Client of the Website where we have a legitimate interest in
            communicating with you, or if you have given us your consent, we will collect and process your
            personal data to communicate with you in case of support and/or sending newsletters,
            push-messages and calls to keep you in touch with our new features, news and events and the
            efficient provision of the full scope of our services. We will also use your data to send you
            marketing information regarding our services that we believe may be of interest to you via email
            or otherwise.
          </p>
          <p>
            Our Website is not intended for children and we do not knowingly collect data relating to
            children. As we do not allow users under the age of 18 to use our services, we need to obtain
            your birth date in order to confirm the Clients&apos; age checks.
          </p>

          {/* 5. OPTING OUT */}
          <h2>5. Opting Out</h2>
          <p>
            If you do not want to receive any marketing newsletters or transmit your data to the third-parties
            for marketing purposes, you can configure your preferences. Such configuring can be done
            when (i) opening an account or (ii) when receiving such advertising content or (iii) by logging in
            and going to My Account &gt; Personal Details &gt; Notification Settings. You may also send to the
            Company, at any time, an email to <strong>{supportEmail}</strong> using the registered email
            address you disclosed and registered with us through your Account asking the Company to
            cease from sending such advertising content or sending your data to the third-parties for
            marketing purposes. The aforesaid mark removal and/or e-mail received by Sun Wave will
            oblige us to cease sending advertisement content to you within 7 (seven) business days.
          </p>

          {/* 6. DISCLOSURE OF DATA */}
          <h2>6. Disclosure of Data</h2>
          <p>We may share your data with the parties for the purposes set out above.</p>
          <p>
            We require all Sun Wave affiliated and/or related companies and any third parties processing
            data on our behalf to respect your data and to treat it in accordance with the provisions of the
            General Data Protection Regulation and applicable local legislation as amended from time to
            time. We take all reasonable steps so that our third-party service providers do not use your
            personal data for their own purposes and only permit them to process your data for specific
            purposes and in accordance with our instructions.
          </p>
          <p>In general, your data is used by the processors of Sun Wave.</p>
          <p>
            In addition, a transfer of your data to another legal entity may occur as part of a transfer of our
            business or parts thereof in the form of a reorganization, sale of assets, consolidation, merger or
            similar.
          </p>
          <p>
            With regard to the transfer of data to recipients outside the related and/or affiliated entities of the
            Company, we note that we strive to maintain discretion with respect to client related matters and
            assessments of which we acquire knowledge. We may disclose data that concerns you only if (i)
            we are legally required to do so; (ii) if required when you expressly order us to process a
            transaction or any other service and (iii) it is required for the provision of our services under our
            contractual relationship and/or (iv) protection of our legitimate interests and applicable
            legislation as amended from time to time.
          </p>

          <h3>External Third Parties</h3>
          <p>Your data is shared with third party organizations/entities including but not limited to:</p>
          <ol className="list-[upper-alpha] pl-5 space-y-4">
            <li>
              <strong>Service Providers.</strong> We may share your data with our trusted third party service providers,
              who, on our behalf, operate, maintain, and/or support our IT systems and IT infrastructure, our
              websites, manage our payment solutions, perform statistical analysis, marketing and advertising
              purposes, sending newsletters, provide customer support and perform other important services
              for us.
            </li>
            <li>
              <strong>Other Sun Wave affiliates / related companies.</strong> We may also disclose your data to other
              Sun Wave affiliates and/or related companies in order for them to provide us with the relevant
              services.
            </li>
            <li>
              <strong>State authorities.</strong> The Client&apos;s details that are provided and/or that will be provided by the
              Client during his/her activity on the site may be disclosed by the Company to official authorities.
              The Company will make such disclosure only if required to be disclosed by the Company by
              applicable law or court order and to the minimum required extent.
            </li>
            <li>
              <strong>Other disclosures.</strong> In addition to where you have consented to a disclosure of the data or
              where disclosure is necessary to achieve the purpose(s) for which it was collected, data may
              also be disclosed in special situations, where we have reason to believe that doing so is
              necessary to identify, contact or bring legal action against anyone damaging, injuring, or
              interfering (intentionally or unintentionally) with our rights or property, users, or anyone else who
              could be harmed by such activities, or otherwise where necessary for the establishment,
              exercise or defense of legal claims.
            </li>
          </ol>
          <p>
            Where reasonably possible, management shall ensure that third parties collecting, storing or
            processing personal information on behalf of the Company have: (a) signed agreements to protect
            personal information consistent with this Privacy Policy; (b) signed non-disclosure agreements or
            confidentiality agreements which include privacy clauses; and (c) established procedures to meet
            the terms of their agreement.
          </p>
          <p>
            Remedial action shall be taken in response to misuse or unauthorized disclosure of personal
            information by a third party collecting, storing or processing personal information on behalf of
            Sun Wave.
          </p>
          <p>
            If you want to obtain further information on any data transfers mentioned above please
            contact us using the registered email address you disclosed and registered with us
            through your Account at <strong>{supportEmail}</strong>.
          </p>

          {/* 7. DATA RETENTION */}
          <h2>7. Data Retention</h2>
          <p>
            We store your data for as long as reasonably necessary to fulfill the purposes we collected it for,
            including for the purposes of satisfying any legal, tax, accounting or reporting requirements. We
            may retain your personal data for a longer period in the event of a complaint or if we reasonably
            believe there is a prospect of litigation in respect to our relationship with you.
          </p>
          <p>
            To determine the appropriate retention period for your data, we consider the amount, nature and
            sensitivity of the data, the potential risk of harm from unauthorized use or disclosure of your
            data, the purposes for which we process your data and whether we can achieve those purposes
            through other means, and the applicable legal, tax, accounting and other requirements.
          </p>
          <p>
            We shall keep your data (including call recordings) during our contractual relationship and for a
            minimum period of <strong>7 (seven) years</strong> from the date of termination of the Platform/Service used by
            the Client.
          </p>
          <p>
            In general, all other data is stored for a period of 30 (thirty) business days after the date of
            termination of the provision of our services unless there is any other legal reason to keep it.
          </p>
          <p>
            At the expiration of the data retention period the data is erased by irreversible destruction and
            we also inform all third parties, to whom the data was transferred, regarding such erasure and
            request implementation of similar actions on their part.
          </p>

          {/* 8. YOUR RIGHTS */}
          <h2>8. Your Rights and How to Withdraw Consents and Unsubscribe</h2>
          <p>
            We ask you to provide us with true, accurate and updated information on your identity and not
            misrepresent yourself to be another individual or legal entity. Any changes in your identifying
            details shall be notified to the Company immediately and in any case no later than the 7th day
            from the date of such changes. If your data is incorrect or incomplete, please contact our
            support services at <strong>{supportEmail}</strong> in order to change your data.
          </p>
          <p>
            Under certain circumstances, you have rights in accordance with applicable legislation and our
            policies as amended from time to time. Some of the rights are rather complex and include
            exemptions, thus we strongly advise you to contact us. You can find a summary of your rights below:
          </p>

          <div className="space-y-4">
            <div className="border-l-2 border-sky-500/30 pl-4">
              <p className="text-white font-semibold">A. The right to access</p>
              <p className="text-sm">You have a right to obtain confirmation as to whether or not your data is being processed by us. In addition, you have a right to obtain more detailed information about the data kept and the processing undertaken by us and under certain circumstances the right to receive a copy of this data. You may access your data by logging onto your Account, going to Personal Data and selecting &quot;Access my Data&quot;.</p>
            </div>
            <div className="border-l-2 border-sky-500/30 pl-4">
              <p className="text-white font-semibold">B. The right to rectification</p>
              <p className="text-sm">You have the right to have inaccurate data about you rectified, and, taking into account the purpose of the processing, to have incomplete data completed.</p>
            </div>
            <div className="border-l-2 border-sky-500/30 pl-4">
              <p className="text-white font-semibold">C. The right to erasure</p>
              <p className="text-sm">This enables you to ask us to delete or remove personal data where there is no good reason for us continuing to process it. You can do so by logging into your Account, going to Personal Data &gt; Account Settings and selecting &quot;Terminate Account – Delete My Account and all of its data&quot;. Please note that we may not always be able to comply with your request of erasure for specific legal reasons.</p>
            </div>
            <div className="border-l-2 border-sky-500/30 pl-4">
              <p className="text-white font-semibold">D. The right to restriction of processing</p>
              <p className="text-sm">You have the right to request restriction of processing of your personal data (a) if it is not accurate; (b) where processing may be unlawful but you do not want us to erase your data; (c) where you need us to hold the data even if we no longer require it; or (d) where you may have objected to our use of your data but we need to verify whether we have overriding legitimate grounds.</p>
            </div>
            <div className="border-l-2 border-sky-500/30 pl-4">
              <p className="text-white font-semibold">E. The right to data portability</p>
              <p className="text-sm">To the extent the legal basis for the processing is your consent, and such processing is carried out by automated means, you have the right to receive your data in a structured, commonly used and machine-readable format. However, this right does not apply where it would adversely affect the rights and freedoms of others.</p>
            </div>
            <div className="border-l-2 border-sky-500/30 pl-4">
              <p className="text-white font-semibold">F. The right to object</p>
              <p className="text-sm">Subject to the legal basis on which the processing activity is based, you may object to processing of your personal data. Please note that in some cases, we may have compelling legitimate grounds to process your information.</p>
            </div>
            <div className="border-l-2 border-sky-500/30 pl-4">
              <p className="text-white font-semibold">G. The right to withdraw consent</p>
              <p className="text-sm">To the extent that the legal basis for the processing is your consent, you have the right to withdraw from that consent at any time. This may apply to marketing purposes and/or with regards to the transfer of your data to third parties. The withdrawal from your consent will in no event affect the lawfulness of processing based on consent before its withdrawal.</p>
            </div>
            <div className="border-l-2 border-sky-500/30 pl-4">
              <p className="text-white font-semibold">H. The right to complain to the data protection supervisory authority</p>
              <p className="text-sm">We do our best to ensure that we protect your data, keep you informed about how we process your data and comply with the applicable data protection regulation. In case you are not satisfied with the processing and protection of your data, please do not hesitate to contact us.</p>
            </div>
          </div>

          <p>
            If you want to exercise any of your rights mentioned above and/or obtain more information, please
            contact us at <strong>{supportEmail}</strong>. Please provide us with relevant information to take care of your
            request, including your full name and email address so that we can identify you. We will respond
            to your request without undue delay.
          </p>
          <p>
            We try to respond to all legitimate requests within one month. Occasionally it could take longer
            than a month if your request is particularly complex or you have made a number of requests. In
            this case, we will notify you and keep you updated. We may charge you a reasonable administrative
            fee for any unreasonable or excessive requests.
          </p>

          {/* 9. DATA SECURITY */}
          <h2>9. Data Security</h2>
          <p>
            We have put in place appropriate security measures to prevent your data from being
            accidentally lost, used or accessed in an unauthorized way, altered or disclosed. In addition, we
            limit access to your data to those employees, agents, contractors and other third parties who
            have a business need to know. They will only process your data on our instructions and they are
            subject to a duty of confidentiality.
          </p>
          <p>
            We have put in place procedures to deal with any suspected data breach and will notify you of a
            breach where we are legally required to do so.
          </p>

          <h3>Your responsibility</h3>
          <p>
            Upon registration to the Website, the Client will be asked to choose a username and password to
            be used on each future login. In order to protect the Client&apos;s privacy, sharing registration details
            (including without limitation, username and password) with other persons or business entities is
            strictly prohibited. The Company shall not be held responsible for any damage or loss caused to
            the Client due to improper use or storage of such username and password.
          </p>
          <p>
            Any use of the Website with the Client&apos;s username and password is Client&apos;s sole responsibility.
            The Client is obliged to forthwith notify the Company&apos;s client service of any suspicion for
            unauthorized use of the Client&apos;s account at <strong>{supportEmail}</strong>.
          </p>

          <h3>Encryption of your data in transit</h3>
          <p>
            Encryption provides a high level of security and privacy for your data. When you enter your data
            in our platform we use strong encryption technologies (such as Transport Layer Security) to
            protect your data during transmission from your devices to our servers. We use digital EV
            (Extended Validation) Certificates issued by trusted Certificate Authorities.
          </p>

          <h3>Protection of your data in our infrastructure</h3>
          <p>
            We make it a priority to develop services that are secure &quot;by default&quot;. All new services and features
            are designed with strict security requirements in mind before we begin development. To secure
            your data, we use pseudonymisation which allows most of our services to operate without using
            your actual data. We locate all our equipment used for data processing in secure data centers with
            network access isolated from the Internet. We use network segmentation for isolation of services
            which need different levels of security. We restrict logical access to your data for our employees
            on a &quot;need to know&quot; basis.
          </p>

          <h3>Threats protection</h3>
          <p>
            Our Company is highly knowledgeable about modern threats to data security and privacy, and we
            are well prepared to combat them. All events that occur in our infrastructure are continuously
            monitored, analyzed and responded to. In the event of a failure that affects the accessibility of your
            data, we have data backup and recovery procedures in place. We use high availability mode
            enabled for most critical databases to minimize downtime.
          </p>

          <h3>Employee awareness of data security</h3>
          <p>
            Our employees may handle your data in order to provide you with first-class service. We monitor
            all employees&apos; actions with access to your data and grant access strictly on a &quot;need to know&quot;
            basis. We hold regular training sessions to make sure that each employee understands the
            principles that the Company follows to achieve robust data security and privacy.
          </p>

          <h3>If you choose not to give your personal information</h3>
          <p>
            In the context of our business relationship we may need to collect data by law, or under the terms
            of a contract we have with you. If you choose not to give us this data, it may delay or prevent us
            from meeting our obligations. It may also mean that we cannot perform services needed to run
            your accounts or policies.
          </p>

          <h3>Automated decision-making and profiling</h3>
          <p>
            In establishing and carrying out a business relationship, we generally do not use automated
            decision-making. If we use this procedure in individual cases, we will inform you of this
            separately. In some cases, we may proceed with profiling in order to evaluate certain personal
            aspects. We shall inform you accordingly. In general, any data collection that is optional would be
            made clear at the point of collection.
          </p>

          {/* 10. CONTACT DETAILS */}
          <h2>10. Our Contact Details</h2>
          <p>
            If you have any questions about this privacy policy, including requests relating to the data,
            please contact our support team using the details set out below.
          </p>
          <p>
            The entity responsible for your data processing is Sun Wave LLC and you can contact us using
            the details set out below.
          </p>
          <div className="bg-white/[0.02] border border-white/5 rounded-lg p-5">
            <p><strong>Address:</strong> Lighthouse Trust Nevis Ltd, Suite 1, A.L. Evelyn Ltd Building, Main Street, Charlestown, Nevis</p>
            <p className="mt-2"><strong>Email:</strong> {supportEmail}</p>
          </div>
          <p>
            To enable us to process your request, please contact us using the registered email address you
            disclosed and registered with us through your Account. We may require that you provide us with
            proof of your identity.
          </p>

          {/* 11. LINKS TO OTHER WEBSITES */}
          <h2>11. Links to Other Websites</h2>
          <p>
            We may provide links to third party websites in our Website. These linked websites are not
            under our control, and we therefore cannot accept responsibility or liability for the conduct of
            third parties linked to our websites, including without limitation to the collection or disclosure of
            your data. Before disclosing your data on any other website, we encourage you to examine the
            terms and conditions of using that website and its privacy policies.
          </p>

          {/* 12. CHANGES */}
          <h2>12. Changes to This Privacy Policy</h2>
          <ol className="list-decimal pl-5">
            <li>
              This Privacy Policy was last updated 21.08.2024. We reserve the right, at our discretion, to add,
              modify or remove portions of this Privacy Policy in the future to ensure that the information
              herein provides relevant and adequate information about our collecting and processing of your
              data.
            </li>
            <li>
              This privacy policy may be supplemented by other information received from the Sun Wave
              group and other terms and conditions applicable to the Website or which you have agreed to as
              part of your interaction with us.
            </li>
            <li>
              In case of updates, we will post the revised Privacy Policy on our website. Changes will take
              effect as soon as the revised version is made available on our website. Your comments and
              feedback are always welcome. You may contact us at any time at <strong>{supportEmail}</strong>.
            </li>
          </ol>

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
