import React from 'react';
import { ThemeProvider as StyledThemeProvider } from 'styled-components';
import { ConfigProvider } from 'antd';
import { styledTheme } from './theme';
import { antdTheme } from '@/common/theme/designSystem';

interface ThemeProviderProps {
    children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
    return (
        <StyledThemeProvider theme={styledTheme}>
            <ConfigProvider theme={antdTheme}>
                {children}
            </ConfigProvider>
        </StyledThemeProvider>
    );
};

export default ThemeProvider; 