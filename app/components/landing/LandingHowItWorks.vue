<template>
  <section class="section-fonctionnement" id="fonctionnement">
    <div class="section-inner">
      <div class="section-header">
        <span class="section-label">FONCTIONNEMENT</span>
        <h2 class="section-title">
          Tu uploades. Tu choisis. <em class="accent-em">Plotline génère.</em>
        </h2>
        <p class="section-subtext">
          Tu configures ton influenceuse une fois, puis le pipeline gere la production sans casser son identite.
        </p>
      </div>

      <div class="fonctionnement-flow">
        <article class="fonctionnement-step">
          <div class="fonctionnement-step-number">01</div>
          <div>
            <h3 class="fonctionnement-step-title">Tu crées ton influenceuse</h3>
            <p class="fonctionnement-step-body">
              Nom, niche, style. Tu uploades une photo de référence visage. C'est tout.
            </p>
          </div>
        </article>
        <article class="fonctionnement-step">
          <div class="fonctionnement-step-number">02</div>
          <div>
            <h3 class="fonctionnement-step-title">Tu choisis le type de contenu</h3>
            <p class="fonctionnement-step-body">
              Feed Pinterest, Feed ou Réel Instagram, ou Story Insta plus lègère, story d'ambiance. Tu choisis un mot-clé ou tu
              laisses Plotline choisir.
            </p>
          </div>
        </article>
        <article class="fonctionnement-step">
          <div class="fonctionnement-step-number">03</div>
          <div>
            <h3 class="fonctionnement-step-title">Plotline génère puis tu valides</h3>
            <p class="fonctionnement-step-body">
              Tu recois une notification quand c'est prêt. Tu valides d'un clic, puis publication Instagram ou TikTok.
            </p>
          </div>
        </article>
      </div>

      <div class="persona-examples-grid">
        <article class="persona-example-card">
          <p class="persona-example-kicker">Pipeline</p>
          <h3 class="persona-example-title">Feed Pinterest</h3>
          <p class="persona-example-priority">Priorité : scene forte + visage cohérent.</p>
          <ul class="persona-example-list">
            <li class="persona-example-item">Récupération d'image source par niche ou mot-clé.</li>
            <li class="persona-example-item">Extraction de scène via analyse image-to-json.</li>
            <li class="persona-example-item">Re génération avec ton influenceuse.</li>
          </ul>
          <p class="persona-example-fit">Idéal pour du volume avec cohérence visuelle.</p>
        </article>

        <article class="persona-example-card">
          <p class="persona-example-kicker">Pipeline</p>
          <h3 class="persona-example-title">Réel Instagram (Motion Control)</h3>
          <p class="persona-example-priority">Priorite : mouvement + identité stable.</p>
          <ul class="persona-example-list">
            <li class="persona-example-item">Récupération de vidéo avec une frame de la vidéo</li> <!-- avec frame pertinente (first best frame), avec un mot-clé ou une niche -->
            <li class="persona-example-item">Génération avec cohérence visuelle sur la frame.</li>
            <li class="persona-example-item">Application du mouvement source via Kling.</li>
          </ul>
          <p class="persona-example-fit">Le format qui scale vite sur TikTok et Insta Reels.</p>
        </article>
      </div>

      <div class="audience-fit-grid">
        <article class="audience-fit-card">
          <p class="audience-fit-label">Createur d'influenceuse IA</p>
          <p class="audience-fit-body">
            Tu gardes le même visage post après post sans passer des heures en retouche manuelle.
          </p>
        </article>
        <article class="audience-fit-card">
          <p class="audience-fit-label">Agence multi-influenceuses</p>
          <p class="audience-fit-body">
            Chaque compte conserve son univers (face ref, style, historique), sans contamination entre profils.
          </p>
        </article>
        <article class="audience-fit-card">
          <p class="audience-fit-label">Createur qui scale</p>
          <p class="audience-fit-body">
            Tu produis plusieurs contenus par semaine en gardant un contrôle éditorial simple: valider puis publier.
          </p>
        </article>
      </div>
    </div>
  </section>
</template>
