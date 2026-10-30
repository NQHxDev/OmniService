import React, { type FC } from 'react';
import { Button, Heading, Section, Text } from '@react-email/components';
import { EMAIL_COLORS } from '@notification/constants';
import { BaseTranslations, getDefaultTranslations } from '@notification/i18n';
import { EmailHeader, EmailLayout } from '@notification/templates/components';

export interface WelcomeEmailProps {
   fullName?: string;
   actionUrl: string;
   translations?: BaseTranslations;
}

export const WelcomeEmail: FC<WelcomeEmailProps> = ({ fullName = 'Customer', actionUrl, translations }) => {
   const currentTranslations = translations || getDefaultTranslations();
   const t = currentTranslations.welcome;
   const common = currentTranslations.common;

   const preview = t.preview.replace('{fullName}', fullName);
   const heading = t.heading.replace('{fullName}', fullName);
   const signoffLines = t.signoff.split('\n');

   return (
      <EmailLayout preview={preview} common={common}>
         <EmailHeader badge={t.badge} brandName={common.brandName} />
         <Section style={content}>
            <Heading as="h2" style={headingStyle}>
               {heading}
            </Heading>
            <Text style={paragraph}>{t.body1}</Text>
            <Text style={paragraph}>{t.body2}</Text>
            <Section style={btnContainer}>
               <Button style={button} href={actionUrl}>
                  {t.ctaButton}
               </Button>
            </Section>
            <Text style={paragraph}>{t.supportText}</Text>
            <Text style={signoffText}>
               {signoffLines[0]}
               <br />
               <strong>{signoffLines.slice(1).join(' ').replace(/\*\*/g, '')}</strong>
            </Text>
         </Section>
      </EmailLayout>
   );
};

export default WelcomeEmail;

const content: React.CSSProperties = {
   padding: '16px 32px 32px 32px',
};

const headingStyle: React.CSSProperties = {
   fontSize: '22px',
   fontWeight: '700',
   color: EMAIL_COLORS.textHeading,
   textAlign: 'center',
   margin: '0 0 16px 0',
   letterSpacing: '-0.3px',
};

const paragraph: React.CSSProperties = {
   fontSize: '15px',
   lineHeight: '24px',
   color: EMAIL_COLORS.textBody,
   margin: '12px 0',
   textAlign: 'center',
};

const btnContainer: React.CSSProperties = {
   textAlign: 'center',
   margin: '28px 0',
};

const button: React.CSSProperties = {
   backgroundColor: EMAIL_COLORS.primary,
   borderRadius: '8px',
   color: EMAIL_COLORS.textWhite,
   fontSize: '15px',
   fontWeight: '600',
   textDecoration: 'none',
   textAlign: 'center',
   display: 'inline-block',
   padding: '12px 32px',
};

const signoffText: React.CSSProperties = {
   fontSize: '15px',
   lineHeight: '24px',
   color: EMAIL_COLORS.textBody,
   margin: '20px 0 0 0',
   textAlign: 'center',
};
