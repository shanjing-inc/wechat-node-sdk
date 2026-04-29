import { XMLBuilder, XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: false,
  trimValues: false
});

const builder = new XMLBuilder({
  cdataPropName: '__cdata',
  ignoreAttributes: false,
  suppressEmptyNode: true
});

export function parseXml<T = unknown>(xml: string): T {
  return parser.parse(xml) as T;
}

export function buildXml(value: unknown): string {
  return builder.build(value);
}
