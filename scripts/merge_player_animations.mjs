import { NodeIO } from '@gltf-transform/core';
import { KHRONOS_EXTENSIONS } from '@gltf-transform/extensions';
import fs from 'node:fs/promises';

const io = new NodeIO().registerExtensions(KHRONOS_EXTENSIONS);
const [, , characterPath, outputPath, ...animPaths] = process.argv;
if (!characterPath || !outputPath || !animPaths.length) {
  throw new Error('Usage: node merge_player_animations.mjs <character.glb> <output.glb> <library1.glb> <library2.glb>');
}
function copyAccessor(targetDoc, source) {
  const array = source.getArray();
  const out = targetDoc.createAccessor().setType(source.getType()).setNormalized(source.getNormalized());
  if (array) out.setArray(array.slice());
  return out;
}
const charDoc = await io.read(characterPath);
const root = charDoc.getRoot();
const normalizeBoneName = name => String(name||'').toLowerCase()
  .replace(/^(mixamorig|armature|skeleton|rig)(?=[:_| -])[:_| -]+/,'').replace(/[^a-z0-9]/g,'');
const rawCharBoneNames = new Set(root.listSkins().flatMap(s => s.listJoints().map(j => normalizeBoneName(j.getName())).filter(Boolean)));
const kaykitStyleRig = rawCharBoneNames.has('upperlegl') && rawCharBoneNames.has('lowerlegl');
const boneAliases = {
  root:'hips', pelvis:'hips', neck01:'neck',
  claviclel:'leftshoulder', clavicler:'rightshoulder',
  upperarml:kaykitStyleRig?'upperarml':'leftarm',
  lowerarml:kaykitStyleRig?'lowerarml':'leftforearm',
  handl:kaykitStyleRig?'handl':'lefthand',
  upperarmr:kaykitStyleRig?'upperarmr':'rightarm',
  lowerarmr:kaykitStyleRig?'lowerarmr':'rightforearm',
  handr:kaykitStyleRig?'handr':'righthand',
  spine01:'spine', spine02:kaykitStyleRig?'chest':'spine01', spine03:kaykitStyleRig?'spine03':'spine02',
  thighl:kaykitStyleRig?'upperlegl':'leftupleg',
  calfl:kaykitStyleRig?'lowerlegl':'leftleg',
  footl:kaykitStyleRig?'footl':'leftfoot',
  balll:kaykitStyleRig?'toesl':'lefttoebase',
  toel:kaykitStyleRig?'toesl':'lefttoebase',
  thighr:kaykitStyleRig?'upperlegr':'rightupleg',
  calfr:kaykitStyleRig?'lowerlegr':'rightleg',
  footr:kaykitStyleRig?'footr':'rightfoot',
  ballr:kaykitStyleRig?'toesr':'righttoebase',
  toer:kaykitStyleRig?'toesr':'righttoebase'
};
const canonicalBoneName = name => {
  const key=normalizeBoneName(name);
  return boneAliases[key]||key;
};
const charNodes = new Map(root.listNodes().filter(n => n.getName()).map(n => [canonicalBoneName(n.getName()), n]));
const charBoneNames = new Set([...rawCharBoneNames].map(canonicalBoneName));
console.log('Character skeleton joints:', [...charBoneNames].join(', '));
const existingNames = new Set(root.listAnimations().map(a => a.getName()));
let addedClips = 0, addedChannels = 0, matchedNodes = new Set();
for (let li = 0; li < animPaths.length; li++) {
  const sourceDoc = await io.read(animPaths[li]);
  const sourceRoot = sourceDoc.getRoot();
  const nodeMap = new Map();
  const sourceNodes = sourceRoot.listNodes().filter(n => n.getName());
  console.log('Animation rig node names:', sourceNodes.map(n => n.getName()).slice(0,80).join(', '));
  for (const node of sourceNodes) {
    const normalized = canonicalBoneName(node.getName());
    const target = charNodes.get(normalized);
    if (target) {
      nodeMap.set(node, target);
      if (charBoneNames.has(normalized)) matchedNodes.add(normalized);
    }
  }
  console.log(`Rig match for ${animPaths[li]}: ${nodeMap.size} nodes; ${matchedNodes.size} actual joints matched`);
  for (const sourceAnim of sourceRoot.listAnimations()) {
    const base = sourceAnim.getName() || `Clip_${addedClips+1}`;
    const prefix = li === 0 ? 'UAL1_' : 'UAL2_';
    let name = prefix + base, suffix = 2;
    while (existingNames.has(name)) name = prefix + base + '_' + suffix++;
    const channels = [];
    for (const channel of sourceAnim.listChannels()) {
      const targetNode = nodeMap.get(channel.getTargetNode());
      const sampler = channel.getSampler();
      if (!targetNode || !sampler?.getInput() || !sampler?.getOutput()) continue;
      channels.push({targetNode, sampler, path: channel.getTargetPath()});
    }
    if (channels.length < 2) continue;
    const outAnim = charDoc.createAnimation(name);
    for (const item of channels) {
      const input = copyAccessor(charDoc, item.sampler.getInput());
      const output = copyAccessor(charDoc, item.sampler.getOutput());
      const outSampler = charDoc.createAnimationSampler().setInput(input).setOutput(output).setInterpolation(item.sampler.getInterpolation());
      outAnim.addSampler(outSampler).addChannel(charDoc.createAnimationChannel().setTargetNode(item.targetNode).setTargetPath(item.path).setSampler(outSampler));
      addedChannels++;
    }
    addedClips++; existingNames.add(name);
  }
}
console.log(`Retarget result: ${matchedNodes.size} unique bones, ${addedClips} added clips, ${addedChannels} animation channels.`);
if (matchedNodes.size < 12 || addedClips < 20 || addedChannels < 100) {
  throw new Error('Rig compatibility too low; refusing to replace the playable character animations.');
}
const bytes = await io.writeBinary(charDoc);
await fs.writeFile(outputPath, bytes);
console.log(`Wrote ${outputPath} (${(bytes.byteLength/1048576).toFixed(2)} MiB)`);
