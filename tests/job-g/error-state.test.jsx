import React from 'react';
import {test,expect} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import BlogLoadError from '../../src/components/blog/BlogLoadError';
test('failed content request offers an accessible Hebrew retry',()=>{const html=renderToStaticMarkup(<BlogLoadError isRTL={true} onRetry={()=>{}}/>);expect(html).toContain('role="alert"');expect(html).toContain('לא הצלחנו לטעון');expect(html).toContain('לנסות שוב')});
