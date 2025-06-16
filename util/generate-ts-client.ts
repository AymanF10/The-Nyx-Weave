import { createFromRoot } from 'codama';
import { AnchorIdl, rootNodeFromAnchor } from '@codama/nodes-from-anchor';
// @ts-ignore
import anchoridl from '../target/idl/the_nyx_weave.json' assert { type: "json" };


import { renderJavaScriptVisitor, renderRustVisitor } from '@codama/renderers';

const idl = anchoridl as AnchorIdl;

const codama = createFromRoot(rootNodeFromAnchor(idl));

codama.accept(renderJavaScriptVisitor('clients/nyx-weave'));